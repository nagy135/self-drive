'use client';

import { useState, useRef, useEffect } from 'react';

interface FileInfo {
  fileName: string;
  originalName: string;
  size: number;
  uploadDate: string;
}

export default function Home() {
  const [currentView, setCurrentView] = useState<'upload' | 'download'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
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

    // Use XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(Math.round(percentComplete));
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        setUploading(false);
        setUploadProgress(0);
        
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status === 200 && data.success) {
            setUploadMessage(`✅ ${file.name} uploaded successfully!`);
            // Reset file input
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            resolve(data);
          } else {
            setUploadMessage(`❌ Error: ${data.message || 'Upload failed'}`);
            reject(new Error(data.message || 'Upload failed'));
          }
        } catch (error) {
          setUploadMessage('❌ Error parsing response');
          reject(error);
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        setUploading(false);
        setUploadProgress(0);
        setUploadMessage('❌ Network error during upload');
        reject(new Error('Network error'));
      });

      // Handle aborts
      xhr.addEventListener('abort', () => {
        setUploading(false);
        setUploadProgress(0);
        setUploadMessage('❌ Upload cancelled');
        reject(new Error('Upload cancelled'));
      });

      // Start the request
      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  };

  const downloadFile = async (fileName: string) => {
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
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
              onClick={() => setCurrentView('upload')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                currentView === 'upload'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Upload
            </button>
            <button
              onClick={() => setCurrentView('download')}
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
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800">
                        {file.originalName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.size)} • Uploaded{' '}
                        {new Date(file.uploadDate).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadFile(file.fileName)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
