import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const filePath = path.join(process.cwd(), 'uploads', filename);

    if (!existsSync(filePath)) {
      return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    
    // Extract original filename
    const parts = filename.split('_');
    const timestamp = parts[parts.length - 1].split('.')[0];
    const extension = path.extname(filename);
    const originalName = filename.replace(`_${timestamp}${extension}`, extension);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Disposition': `attachment; filename="${originalName}"`,
        'Content-Type': 'application/octet-stream',
      },
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json({ success: false, message: 'Error downloading file' }, { status: 500 });
  }
} 