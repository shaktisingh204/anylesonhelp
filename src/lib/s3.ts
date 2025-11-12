import 'server-only';
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.BUCKET_NAME;

export type S3Folder = {
  name: string;
  prefix: string;
};
export type S3File = {
  key: string;
  name: string;
  url: string;
  size: number;
  sizeFormatted: string;
};

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.avi', '.webm'];

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function cleanName(key: string): string {
  const parts = key.split('/');
  const fileName = parts[parts.length - 1];
  return fileName.replace(/^\d+-/, '').replace(/^\d+\+-/, '');
}

export async function listS3Objects(prefix: string = ''): Promise<{ folders: S3Folder[], files: S3File[] }> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      Delimiter: '/',
    });
    const response = await s3Client.send(command);

    const folders: S3Folder[] = (response.CommonPrefixes || []).map(p => ({
      name: p.Prefix!.replace(prefix, '').replace(/\/$/, ''),
      prefix: p.Prefix!,
    }));

    const files: S3File[] = (response.Contents || [])
      .filter(obj => obj.Key && VIDEO_EXTENSIONS.some(ext => obj.Key!.toLowerCase().endsWith(ext)))
      .map(obj => ({
        key: obj.Key!,
        name: cleanName(obj.Key!),
        url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`,
        size: obj.Size!,
        sizeFormatted: formatBytes(obj.Size!),
      }));

    return { folders, files };
  } catch (error) {
    console.error("Error listing S3 objects:", error);
    throw new Error("Failed to connect to S3. Please check your credentials and bucket configuration.");
  }
}


export async function listAllVideosRecursive(prefix: string): Promise<Record<string, S3File[]>> {
  const allFilesByFolder: Record<string, S3File[]> = {};
  const prefixesToScan: string[] = [prefix];

  while (prefixesToScan.length > 0) {
    const currentPrefix = prefixesToScan.shift()!;
    
    let continuationToken: string | undefined;
    do {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: currentPrefix,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(command);

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key && VIDEO_EXTENSIONS.some(ext => obj.Key!.toLowerCase().endsWith(ext))) {
             const folderPath = obj.Key.substring(0, obj.Key.lastIndexOf('/') + 1);
             if (!allFilesByFolder[folderPath]) {
                allFilesByFolder[folderPath] = [];
             }
             allFilesByFolder[folderPath].push({
                key: obj.Key!,
                name: cleanName(obj.Key!),
                url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`,
                size: obj.Size!,
                sizeFormatted: formatBytes(obj.Size!),
             });
          }
        }
      }
      
      continuationToken = response.NextContinuationToken;

    } while (continuationToken);
  }
  return allFilesByFolder;
}

export async function listAllFilesRecursive(prefix: string): Promise<S3File[]> {
    const allFiles: S3File[] = [];
    let continuationToken: string | undefined;

    do {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix,
            ContinuationToken: continuationToken,
        });

        const response = await s3Client.send(command);

        if (response.Contents) {
            const files = response.Contents
                .filter(obj => obj.Key && VIDEO_EXTENSIONS.some(ext => obj.Key!.toLowerCase().endsWith(ext)) && obj.Size)
                .map(obj => ({
                    key: obj.Key!,
                    name: cleanName(obj.Key!),
                    url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`,
                    size: obj.Size!,
                    sizeFormatted: formatBytes(obj.Size!),
                }));
            allFiles.push(...files);
        }

        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return allFiles;
}
