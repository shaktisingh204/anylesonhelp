import { listAllVideosRecursive } from '@/lib/s3';
import { createExcelFile } from '@/lib/excel';
import { NextResponse } from 'next/server';
import JSZip from 'jszip';

export async function POST(request: Request) {
  try {
    const { prefix } = await request.json() as { prefix: string };
    const filesByFolder = await listAllVideosRecursive(prefix);

    if (Object.keys(filesByFolder).length === 0) {
      return NextResponse.json({ error: 'No video files found in any subfolder.' }, { status: 404 });
    }

    const zip = new JSZip();

    for (const folderPath in filesByFolder) {
      if (filesByFolder[folderPath].length > 0) {
        const excelBuffer = await createExcelFile(filesByFolder[folderPath]);
        const excelFileName = folderPath.replace(/\/$/, '').replace(/\//g, '_') + '.xlsx';
        zip.file(excelFileName, excelBuffer);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipFilename = `export-all_${(prefix.replace(/\/$/, '') || 'root').replace(/\//g, '_')}.zip`;

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
      },
    });

  } catch (error) {
    console.error("Recursive export error:", error);
    return NextResponse.json({ error: 'Failed to generate ZIP file.' }, { status: 500 });
  }
}
