// public/script.js
const foldersEl = document.getElementById("folders");
const filesTbody = document.querySelector("#filesTable tbody");
const currentTitle = document.getElementById("currentTitle");
const currentPrefixEl = document.getElementById("currentPrefix");
const exportBtn = document.getElementById("exportBtn");
const browseBtn = document.getElementById("browseBtn");
const deepBtn = document.getElementById("deepBtn");
const exportAllBtn = document.getElementById("exportAllBtn");
const noFilesEl = document.getElementById("noFiles");

let currentPrefix = ""; // prefix string
let currentFiles = []; // array of file objects (key, name, sizeHuman, url)

// Helper to call backend
async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// Load top-level folders (or under prefix)
async function loadFolders(prefix = "") {
  try {
    foldersEl.innerHTML = "<div class='muted'>Loading...</div>";
    currentPrefix = prefix;
    currentTitle.textContent = prefix ? `Folder: ${prefix}` : "Select a folder";
    currentPrefixEl.textContent = prefix || "";

    const data = await api(`/folders?prefix=${encodeURIComponent(prefix)}`);
    const { folders = [], files = [] } = data || {};

    // render folders
    if (!folders || folders.length === 0) {
      foldersEl.innerHTML = "<div class='muted'>No subfolders</div>";
    } else {
      foldersEl.innerHTML = "";
      folders.forEach((f) => {
        const btn = document.createElement("div");
        btn.className = "folder-item";
        btn.innerHTML = `<div style="font-size:18px">📁</div><div class="folder-name">${f.name}</div>`;
        btn.onclick = () => loadFolders(f.prefix);
        foldersEl.appendChild(btn);
      });
    }

    // show any files directly in this prefix
    if (files && files.length) {
      currentFiles = files;
      renderFiles();
      exportBtn.style.display = "inline-block";
    } else {
      currentFiles = [];
      renderFiles();
      exportBtn.style.display = "none";
    }
  } catch (err) {
    console.error(err);
    foldersEl.innerHTML = `<div class="muted">Failed to load folders: ${err.message}</div>`;
  }
}

function renderFiles() {
  filesTbody.innerHTML = "";
  if (!currentFiles || currentFiles.length === 0) {
    noFilesEl.style.display = "block";
    return;
  }
  noFilesEl.style.display = "none";
  currentFiles.forEach((f) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(f.name)}</td>
                    <td class="small">${escapeHtml(f.sizeHuman)}</td>
                    <td><a href="${f.url}" target="_blank">Open</a></td>`;
    filesTbody.appendChild(tr);
  });
}

// Escape helper
function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// Show deep files (recursive)
async function showDeepFiles() {
  try {
    if (!currentPrefix) {
      alert("Please browse and select a folder first (Browse Folders).");
      return;
    }
    filesTbody.innerHTML = "";
    noFilesEl.style.display = "none";
    currentTitle.textContent = "All Deep Files";
    currentPrefixEl.textContent = currentPrefix;

    const data = await api(`/deep-files?prefix=${encodeURIComponent(currentPrefix)}`);
    const files = data.files || [];
    if (!files.length) {
      noFilesEl.style.display = "block";
      noFilesEl.textContent = "No video files found in this folder tree.";
      exportBtn.style.display = "none";
      return;
    }

    // group by folder
    const grouped = files.reduce((acc, f) => {
      const folderKey = f.folder || "root";
      acc[folderKey] = acc[folderKey] || [];
      acc[folderKey].push(f);
      return acc;
    }, {});

    // flatten for display: show folder headers and rows
    filesTbody.innerHTML = "";
    Object.keys(grouped).forEach((folder) => {
      const headerRow = document.createElement("tr");
      headerRow.innerHTML = `<td colspan="3" style="background:#f7f9fc;font-weight:700">${escapeHtml(folder || "root")}</td>`;
      filesTbody.appendChild(headerRow);

      grouped[folder].forEach((f) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${escapeHtml(f.name)}</td><td class="small">${escapeHtml(f.sizeHuman)}</td><td><a href="${f.url}" target="_blank">Open</a></td>`;
        filesTbody.appendChild(tr);
      });
    });

    currentFiles = files;
    exportBtn.style.display = "inline-block";
  } catch (err) {
    console.error(err);
    alert("Failed to load deep files: " + err.message);
  }
}

// Export current prefix (single xlsx for all videos under prefix)
async function exportThisFolder() {
  try {
    const payload = { prefix: currentPrefix };
    const res = await fetch("/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Export failed");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fname = (currentPrefix || "root").replace(/\//g, "_") + ".xlsx";
    a.download = fname;
    a.click();
  } catch (err) {
    console.error(err);
    alert("Export failed: " + err.message);
  }
}

// Export all (zip of xlsx files)
async function exportAllZip() {
  try {
    const payload = { prefix: currentPrefix || "" };
    const res = await fetch("/export-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Export all failed");
    }
    // response is zip stream
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "s3_videos_export.zip";
    a.click();
  } catch (err) {
    console.error(err);
    alert("Export all failed: " + err.message);
  }
}

// Wire UI
browseBtn.addEventListener("click", () => loadFolders(""));
deepBtn.addEventListener("click", showDeepFiles);
exportBtn.addEventListener("click", exportThisFolder);
exportAllBtn.addEventListener("click", exportAllZip);

// initial empty state
foldersEl.innerHTML = "<div class='muted'>Click 'Browse Folders' to start</div>";
