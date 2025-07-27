'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios, { AxiosProgressEvent } from 'axios';
import path from 'path';

interface FileInfo {
  fileName: string;
  originalName: string;
  size: number;
  uploadDate: string;
}

function FileManager() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Initialize currentView based on URL parameter, default to 'upload'
  const [currentView, setCurrentView] = useState<'upload' | 'download'>(() => {
    const tab = searchParams.get('tab');
    return tab === 'download' ? 'download' : 'upload';
  });
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<FileInfo | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameMessage, setRenameMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/files');
      const data = await response.json();
      if (data.success) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update currentView when URL parameter changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    const newView = tab === 'download' ? 'download' : 'upload';
    setCurrentView(newView);
  }, [searchParams]);

  useEffect(() => {
    if (currentView === 'download') {
      fetchFiles();
    }
  }, [currentView]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/upload', formData, {
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(progress);
        },
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setUploadMessage(`✅ ${file.name} uploaded successfully!`);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setUploadMessage(`❌ Error: ${response.data.message}`);
      }
    } catch (error: unknown) {
      console.error('Upload error:', error);
      if (axios.isAxiosError(error)) {
        setUploadMessage(`❌ Error: ${error.response?.data?.message || error.message}`);
      } else {
        setUploadMessage('❌ Error uploading file');
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadFile = async (fileName: string) => {
    setDownloadingFile(fileName);
    setDownloadMessage('');
    
    try {
      const response = await fetch(`/api/download/${fileName}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Show success message
        setDownloadMessage(`✅ ${fileName} downloaded successfully!`);
        
        // Clear message after 3 seconds
        setTimeout(() => {
          setDownloadMessage('');
        }, 3000);
      } else {
        setDownloadMessage(`❌ Error downloading ${fileName}`);
        setTimeout(() => {
          setDownloadMessage('');
        }, 3000);
      }
    } catch (error) {
      console.error('Download error:', error);
      setDownloadMessage(`❌ Error downloading ${fileName}`);
      setTimeout(() => {
        setDownloadMessage('');
      }, 3000);
    } finally {
      setDownloadingFile(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const openRenameModal = (file: FileInfo) => {
    setFileToRename(file);
    // Set initial value to current name without extension
    const nameWithoutExt = file.originalName.replace(/\.[^/.]+$/, '');
    setNewFileName(nameWithoutExt);
    setIsRenameModalOpen(true);
    setRenameMessage('');
  };

  const closeRenameModal = () => {
    setIsRenameModalOpen(false);
    setFileToRename(null);
    setNewFileName('');
    setRenameMessage('');
  };

  const renameFile = async () => {
    if (!fileToRename || !newFileName.trim()) {
      setRenameMessage('❌ Please enter a valid filename');
      return;
    }

    setRenaming(true);
    setRenameMessage('');

    try {
      const response = await fetch('/api/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentFileName: fileToRename.fileName,
          newName: newFileName.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setRenameMessage('✅ File renamed successfully!');
        // Update the files list
        fetchFiles();
        // Close modal after a short delay
        setTimeout(() => {
          closeRenameModal();
        }, 1500);
      } else {
        setRenameMessage(`❌ ${data.message}`);
      }
    } catch (error) {
      console.error('Rename error:', error);
      setRenameMessage('❌ Error renaming file');
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          File Upload & Download
        </h1>

        {/* Navigation Buttons */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-md">
            <button
              onClick={() => {
                setCurrentView('upload');
                router.push('/');
              }}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                currentView === 'upload'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Upload
            </button>
            <button
              onClick={() => {
                setCurrentView('download');
                router.push('/?tab=download');
              }}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                currentView === 'download'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Download
            </button>
          </div>
        </div>

        {/* Upload View */}
        {currentView === 'upload' && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragActive
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="space-y-4">
                <div className="text-4xl">📁</div>
                <div>
                  <p className="text-lg font-medium text-gray-700">
                    Drag and drop your file here
                  </p>
                  <p className="text-gray-500 mt-2">or</p>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  disabled={uploading}
                />
                <label
                  htmlFor="file-upload"
                  className={`inline-block px-6 py-3 rounded-lg cursor-pointer font-medium transition-colors ${
                    uploading
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {uploading ? 'Uploading...' : 'Choose File'}
                </label>
              </div>
            </div>

            {/* Progress Bar */}
            {uploading && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {uploadMessage && !uploading && (
              <div className="mt-4 text-center">
                <div className="inline-block px-4 py-2 bg-gray-100 text-gray-800 rounded-lg">
                  {uploadMessage}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Download View */}
        {currentView === 'download' && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-xl font-semibold mb-6 text-gray-800">
              Uploaded Files
            </h2>

            {/* Download Message */}
            {downloadMessage && (
              <div className="mb-4 text-center">
                <div className="inline-block px-4 py-2 bg-gray-100 text-gray-800 rounded-lg">
                  {downloadMessage}
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  Loading files...
                </div>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-4">📭</div>
                <p>No files uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 
                        className="font-medium text-gray-800 break-words cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => openRenameModal(file)}
                        title="Click to rename"
                      >
                        {file.originalName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.size)} • Uploaded{' '}
                        {new Date(file.uploadDate).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadFile(file.fileName)}
                      disabled={downloadingFile === file.fileName}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-colors min-w-[100px] ${
                        downloadingFile === file.fileName
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-green-500 hover:bg-green-600 text-white'
                      }`}
                    >
                      {downloadingFile === file.fileName ? (
                        <span className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Downloading...
                        </span>
                      ) : (
                        'Download'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rename Modal */}
        {isRenameModalOpen && (
          <div 
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
          >
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl border">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                Rename File
              </h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current name: <span className="font-normal text-gray-900">{fileToRename?.originalName}</span>
                </label>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New name:
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    placeholder="Enter new filename"
                    disabled={renaming}
                    onKeyPress={(e) => e.key === 'Enter' && !renaming && renameFile()}
                  />
                  <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-700 font-medium">
                    {fileToRename ? path.extname(fileToRename.originalName) : ''}
                  </span>
                </div>
              </div>

              {renameMessage && (
                <div className="mb-4 text-center">
                  <div className="inline-block px-4 py-2 bg-gray-50 text-gray-900 rounded-lg text-sm border">
                    {renameMessage}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeRenameModal}
                  disabled={renaming}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={renameFile}
                  disabled={renaming || !newFileName.trim()}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    renaming || !newFileName.trim()
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {renaming ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Renaming...
                    </span>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-8">
            <div className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
              Loading...
            </div>
          </div>
        </div>
      </div>
    }>
      <FileManager />
    </Suspense>
  );
}
