import 'server-only';
import ExcelJS from 'exceljs';
import type { S3File } from './s3';

export async function createExcelFile(files: S3File[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Videos');

  worksheet.columns = [
    { header: 'Name', key: 'name', width: 50 },
    { header: 'URL', key: 'url', width: 100 },
    { header: 'Size', key: 'size', width: 20 },
  ];

  worksheet.getRow(1).font = { bold: true };

  files.forEach(file => {
    worksheet.addRow({
      name: file.name,
      url: file.url,
      size: file.sizeFormatted,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}
