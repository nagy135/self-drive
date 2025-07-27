import { NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (!existsSync(uploadsDir)) {
      return NextResponse.json({ success: true, files: [] });
    }

    const files = await readdir(uploadsDir);
    const fileDetails = await Promise.all(
      files.map(async (fileName) => {
        const filePath = path.join(uploadsDir, fileName);
        const stats = await stat(filePath);
        
        // Extract original name from timestamped filename
        const parts = fileName.split('_');
        const timestamp = parts[parts.length - 1].split('.')[0];
        const extension = path.extname(fileName);
        const originalName = fileName.replace(`_${timestamp}${extension}`, extension);
        
        return {
          fileName,
          originalName,
          size: stats.size,
          uploadDate: stats.mtime
        };
      })
    );

    // Sort files by modification time in descending order (newest first)
    fileDetails.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());

    return NextResponse.json({ success: true, files: fileDetails });
  } catch (error) {
    console.error('Error reading files:', error);
    return NextResponse.json({ success: false, message: 'Error reading files' }, { status: 500 });
  }
} 