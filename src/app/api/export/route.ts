import { createExcelFile } from '@/lib/excel';
import { NextResponse } from 'next/server';
import type { S3File } from '@/lib/s3';

export async function POST(request: Request) {
  try {
    const { files, prefix } = await request.json() as { files: S3File[], prefix: string };
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files to export.' }, { status: 400 });
    }
    
    const buffer = await createExcelFile(files);
    
    const filename = (prefix.replace(/\/$/, '') || 'root').replace(/\//g, '_') + '.xlsx';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: 'Failed to generate Excel file.' }, { status: 500 });
  }
}
