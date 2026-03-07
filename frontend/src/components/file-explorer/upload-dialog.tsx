'use client';

import { useState, useCallback } from 'react';
import { CloudUpload, X, File, CheckCircle, AlertCircle } from 'lucide-react';
import { type Evidence } from '@/lib/mock-data';

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (files: UploadedFile[]) => void;
}

interface UploadedFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

export default function UploadDialog({ open, onOpenChange, onUpload }: UploadDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  }, []);

  const handleFiles = (files: File[]) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/zip'];
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.zip'];

    const newFiles: UploadedFile[] = files.map(file => {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension);

      if (!isValidType) {
        return {
          file,
          id: Math.random().toString(36).substr(2, 9),
          status: 'error' as const,
          progress: 0,
          error: 'Invalid file format. Only PDF, JPG, PNG, DOC, and ZIP are supported.'
        };
      }

      return {
        file,
        id: Math.random().toString(36).substr(2, 9),
        status: 'pending' as const,
        progress: 0
      };
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const handleUploadFiles = async () => {
    const pendingFiles = uploadedFiles.filter(f => f.status === 'pending');
    const successfulUploads: UploadedFile[] = [];

    for (const uploadedFile of pendingFiles) {
      // Set status to uploading
      setUploadedFiles(prev =>
        prev.map(f =>
          f.id === uploadedFile.id
            ? { ...f, status: 'uploading' }
            : f
        )
      );

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadedFiles(prev =>
          prev.map(f => {
            if (f.id === uploadedFile.id && f.status === 'uploading' && f.progress < 90) {
              return { ...f, progress: Math.min(f.progress + 15, 90) };
            }
            return f;
          })
        );
      }, 300);

      // Simulate upload (in real app, this would be an API call)
      await new Promise(resolve => setTimeout(resolve, 2000));

      clearInterval(progressInterval);

      // Set success status
      const updatedFile = { ...uploadedFile, status: 'success' as const, progress: 100 };
      setUploadedFiles(prev =>
        prev.map(f =>
          f.id === uploadedFile.id
            ? updatedFile
            : f
        )
      );

      // Track successful uploads
      successfulUploads.push(updatedFile);
    }

    // Call onUpload callback for successful uploads after all are done
    if (successfulUploads.length > 0) {
      onUpload(successfulUploads);
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleClose = () => {
    setUploadedFiles([]);
    onOpenChange(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const hasPendingFiles = uploadedFiles.some(f => f.status === 'pending');
  const hasUploadingFiles = uploadedFiles.some(f => f.status === 'uploading');
  const allUploadsComplete = uploadedFiles.length > 0 && uploadedFiles.every(f => f.status === 'success' || f.status === 'error');
  const hasSuccessfulUploads = uploadedFiles.some(f => f.status === 'success');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-[600px] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-normal text-gray-900">Upload Evidence</h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <CloudUpload className="h-12 w-12 mx-auto mb-4 text-gray-400" strokeWidth={1} />
            <p className="text-sm text-gray-700 mb-2">
              Drag and drop your files
            </p>
            <p className="text-xs text-gray-500 mb-4">
              or
            </p>
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="inline-block px-4 py-2 text-sm font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
                Browse Files
              </span>
            </label>
            <input
              id="file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInput}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.zip"
            />
            <p className="text-xs text-gray-500 mt-4">
              Supported formats: PDF, JPG, PNG, DOC, ZIP
            </p>
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Files ({uploadedFiles.length})</h4>
              {uploadedFiles.map((uploadedFile) => (
                <div
                  key={uploadedFile.id}
                  className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50 border border-gray-200"
                >
                  <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate text-gray-900">
                        {uploadedFile.file.name}
                      </p>
                      <span className="text-xs text-gray-500 ml-2">
                        {formatFileSize(uploadedFile.file.size)}
                      </span>
                    </div>
                    {uploadedFile.status === 'uploading' && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-gray-900 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadedFile.progress}%` }}
                        />
                      </div>
                    )}
                    {uploadedFile.status === 'success' && (
                      <div className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        <span className="text-xs">Uploaded successfully</span>
                      </div>
                    )}
                    {uploadedFile.status === 'error' && (
                      <div className="flex items-center space-x-1 text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        <span className="text-xs">{uploadedFile.error || 'Upload failed'}</span>
                      </div>
                    )}
                  </div>
                  {uploadedFile.status !== 'uploading' && (
                    <button
                      onClick={() => removeFile(uploadedFile.id)}
                      className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end items-center space-x-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            {allUploadsComplete ? 'Close' : 'Cancel'}
          </button>

          <button
            onClick={handleUploadFiles}
            disabled={!hasPendingFiles || hasUploadingFiles}
            className="px-4 py-2 text-sm font-medium text-white bg-black border border-black rounded-md hover:bg-gray-900 transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:border-gray-300"
          >
            {hasUploadingFiles ? 'Uploading...' : allUploadsComplete && hasSuccessfulUploads ? 'Done' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
