import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { rename as renameAsync } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { currentFileName, newName } = await request.json();

    if (!currentFileName || !newName) {
      return NextResponse.json({ 
        success: false, 
        message: 'Current filename and new name are required' 
      }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    const currentFilePath = path.join(uploadsDir, currentFileName);
    
    if (!existsSync(currentFilePath)) {
      return NextResponse.json({ 
        success: false, 
        message: 'File not found' 
      }, { status: 404 });
    }

    // Extract timestamp and extension from current filename
    const parts = currentFileName.split('_');
    const timestamp = parts[parts.length - 1].split('.')[0];
    const extension = path.extname(currentFileName);
    
    // Sanitize the new name (remove special characters, keep only alphanumeric, dashes, underscores)
    const sanitizedNewName = newName.replace(/[^a-zA-Z0-9\-_]/g, '_');
    
    // Create new filename with timestamp
    const newFileName = `${sanitizedNewName}_${timestamp}${extension}`;
    const newFilePath = path.join(uploadsDir, newFileName);
    
    // Check if new filename already exists
    if (existsSync(newFilePath)) {
      return NextResponse.json({ 
        success: false, 
        message: 'A file with this name already exists' 
      }, { status: 409 });
    }

    // Rename the file
    await renameAsync(currentFilePath, newFilePath);

    return NextResponse.json({ 
      success: true, 
      message: 'File renamed successfully',
      oldFileName: currentFileName,
      newFileName: newFileName,
      newDisplayName: `${sanitizedNewName}${extension}`
    });
  } catch (error) {
    console.error('Error renaming file:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Error renaming file' 
    }, { status: 500 });
  }
} 