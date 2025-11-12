// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import ExcelJS from "exceljs";
import archiver from "archiver";
import stream from "stream";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const REGION = process.env.AWS_REGION;
const BUCKET = process.env.BUCKET_NAME;

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !REGION || !BUCKET) {
  console.error("Missing required .env variables. See .env.example");
  process.exit(1);
}

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Helpers
const VIDEO_EXT_REGEX = /\.(mp4|mov|mkv|avi|webm)$/i;

function isVideoKey(key) {
  return VIDEO_EXT_REGEX.test(key);
}

function cleanName(filename) {
  // Remove extension, replace plus with space, remove leading numbers + separators
  let s = filename.replace(/\+/g, " ");
  s = decodeURIComponent(s);
  s = s.replace(/\.[^/.]+$/, ""); // strip extension
  // Remove leading numbers followed by separators like "01 - " or "1.1 "
  s = s.replace(/^[0-9]+([.\-\_\+\s])+/, "");
  // Remove excessive separators, normalize spaces
  s = s.replace(/[_\-+]+/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

function formatSize(bytes) {
  if (bytes === undefined || bytes === null) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function s3PublicUrlForKey(key) {
  // Keep slashes, percent-encode special characters
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
}

// Pagination helper to list all objects under prefix (non-delimited)
async function listAllObjects(prefix = "") {
  let continuationToken = undefined;
  const all = [];
  do {
    const cmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const resp = await s3.send(cmd);
    (resp.Contents || []).forEach((c) => all.push(c));
    continuationToken = resp.NextContinuationToken;
  } while (continuationToken);
  return all;
}

// List "folders" and top-level files under prefix (Delimiter = '/')
app.get("/folders", async (req, res) => {
  try {
    const prefix = req.query.prefix || "";
    const cmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      Delimiter: "/",
    });
    const resp = await s3.send(cmd);

    const folders = (resp.CommonPrefixes || []).map((p) => ({
      name: p.Prefix.replace(prefix, "").replace(/\/$/, ""),
      prefix: p.Prefix,
    }));

    const files = (resp.Contents || [])
      .filter((c) => isVideoKey(c.Key))
      .map((c) => ({
        key: c.Key,
        name: cleanName(c.Key.split("/").pop()),
        sizeBytes: c.Size,
        sizeHuman: formatSize(c.Size),
        url: s3PublicUrlForKey(c.Key),
      }));

    res.json({ folders, files });
  } catch (err) {
    console.error("Error /folders:", err);
    res.status(500).json({ error: String(err) });
  }
});

// List only video files under prefix (non-recursive)
app.get("/files", async (req, res) => {
  try {
    const prefix = req.query.prefix || "";
    const cmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
    });
    const resp = await s3.send(cmd);
    const files = (resp.Contents || [])
      .filter((c) => isVideoKey(c.Key))
      .map((c) => ({
        key: c.Key,
        name: cleanName(c.Key.split("/").pop()),
        sizeBytes: c.Size,
        sizeHuman: formatSize(c.Size),
        url: s3PublicUrlForKey(c.Key),
      }));
    res.json({ files });
  } catch (err) {
    console.error("Error /files:", err);
    res.status(500).json({ error: String(err) });
  }
});

// Deep list: recursively gather all video files under prefix
app.get("/deep-files", async (req, res) => {
  try {
    const prefix = req.query.prefix || "";
    const allObjects = await listAllObjects(prefix);
    const videos = allObjects
      .filter((c) => isVideoKey(c.Key))
      .map((c) => {
        const lastSlash = c.Key.lastIndexOf("/");
        const folderPath = lastSlash === -1 ? "" : c.Key.substring(0, lastSlash);
        return {
          key: c.Key,
          folder: folderPath,
          name: cleanName(c.Key.split("/").pop()),
          sizeBytes: c.Size,
          sizeHuman: formatSize(c.Size),
          url: s3PublicUrlForKey(c.Key),
        };
      });
    res.json({ files: videos });
  } catch (err) {
    console.error("Error /deep-files:", err);
    res.status(500).json({ error: String(err) });
  }
});

// Export single folder: returns .xlsx stream
app.post("/export", async (req, res) => {
  try {
    const { prefix } = req.body || {};
    const targetPrefix = prefix || "";

    const allObjects = await listAllObjects(targetPrefix);
    const videos = allObjects.filter((c) => isVideoKey(c.Key)).map((c) => ({
      key: c.Key,
      name: cleanName(c.Key.split("/").pop()),
      sizeBytes: c.Size,
      sizeHuman: formatSize(c.Size),
      url: s3PublicUrlForKey(c.Key),
    }));

    if (!videos.length) {
      return res.status(404).json({ error: "No video files found" });
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Videos");
    ws.columns = [
      { header: "Name", key: "name", width: 50 },
      { header: "Size (MB)", key: "size", width: 18 },
      { header: "URL", key: "url", width: 100 },
    ];
    videos.forEach((v) => ws.addRow({ name: v.name, size: (v.sizeBytes / (1024 * 1024)).toFixed(2), url: v.url }));

    const filenameSafe = (targetPrefix || "root").replace(/\//g, "_") || "root";
    res.setHeader("Content-Disposition", `attachment; filename="${filenameSafe}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error /export:", err);
    res.status(500).json({ error: String(err) });
  }
});

// Export all: generate one .xlsx per folder (grouped by folder) inside a ZIP and stream it
app.post("/export-all", async (req, res) => {
  try {
    const { prefix } = req.body || {};
    const targetPrefix = prefix || "";

    const allObjects = await listAllObjects(targetPrefix);
    const videos = allObjects.filter((c) => isVideoKey(c.Key)).map((c) => {
      const lastSlash = c.Key.lastIndexOf("/");
      const folderPath = lastSlash === -1 ? "" : c.Key.substring(0, lastSlash);
      return {
        key: c.Key,
        folder: folderPath,
        name: cleanName(c.Key.split("/").pop()),
        sizeBytes: c.Size,
        sizeHuman: formatSize(c.Size),
        url: s3PublicUrlForKey(c.Key),
      };
    });

    if (!videos.length) {
      return res.status(404).json({ error: "No video files found" });
    }

    // Group by folder
    const groups = videos.reduce((acc, v) => {
      const folderKey = v.folder || "root";
      acc[folderKey] = acc[folderKey] || [];
      acc[folderKey].push(v);
      return acc;
    }, {});

    // Prepare zip stream
    res.setHeader("Content-Disposition", `attachment; filename="s3_videos_export.zip"`);
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      throw err;
    });
    archive.pipe(res);

    // For each group, create workbook buffer and append to zip
    for (const folderKey of Object.keys(groups)) {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Videos");
      ws.columns = [
        { header: "Name", key: "name", width: 50 },
        { header: "Size (MB)", key: "size", width: 18 },
        { header: "URL", key: "url", width: 100 },
      ];
      groups[folderKey].forEach((v) =>
        ws.addRow({ name: v.name, size: (v.sizeBytes / (1024 * 1024)).toFixed(2), url: v.url })
      );
      const buf = await wb.xlsx.writeBuffer();
      // create safe filename for folder
      const safeName = (folderKey || "root").replace(/\/+/g, "_").replace(/^_+|_+$/g, "");
      const entryName = `${safeName || "root"}.xlsx`;
      archive.append(Buffer.from(buf), { name: entryName });
    }

    await archive.finalize();
    // response will be the zip stream
  } catch (err) {
    console.error("Error /export-all:", err);
    // if headers already sent, can't set JSON
    if (!res.headersSent) res.status(500).json({ error: String(err) });
    else res.end();
  }
});

// Serve UI root
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});
