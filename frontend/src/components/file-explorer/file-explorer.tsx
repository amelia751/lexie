'use client';

import { type Evidence } from '@/lib/mock-data';
import { File, Upload, Search, Loader2, FolderOpen } from 'lucide-react';
import { useEvidence } from '@/contexts/evidence-context';
import { useLiveCase, type LiveUploadedFile } from '@/contexts/live-case-context';
import { useState } from 'react';
import UploadDialog from './upload-dialog';

interface FileExplorerProps {
  onFileSelect?: (evidence: Evidence) => void;
  selectedFileId?: string;
}

interface UploadedFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

const getFileIcon = (status?: string) => {
  if (status === 'processing') {
    return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
  }
  return <File className="h-4 w-4 text-muted-foreground" />;
};

export default function FileExplorer({ onFileSelect, selectedFileId }: FileExplorerProps) {
  const { evidence, addEvidence, mode } = useEvidence();
  const { uploadedFiles, addUploadedFile, updateFileStatus, isSessionActive, highlightedFileId } = useLiveCase();
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const handleUploadClick = () => {
    setUploadDialogOpen(true);
  };

  const handleUploadComplete = (uploadedFilesData: UploadedFile[]) => {
    uploadedFilesData.forEach(uploadedFile => {
      if (mode === 'live') {
        // In live mode, add to LiveCaseContext with processing status
        const fileId = addUploadedFile({
          name: uploadedFile.file.name,
          size: formatFileSize(uploadedFile.file.size),
          type: getEvidenceType(uploadedFile.file.name),
          status: 'processing',
        });
        
        // Simulate processing delay (in real app, this would be actual backend processing)
        setTimeout(() => {
          updateFileStatus(fileId, 'processed');
        }, 2000 + Math.random() * 2000);
      } else {
        // In mock mode, add directly as processed
        const newEvidence: Evidence = {
          id: `evidence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: uploadedFile.file.name,
          type: getEvidenceType(uploadedFile.file.name),
          uploadedAt: new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          size: formatFileSize(uploadedFile.file.size),
          status: 'processed',
        };
        addEvidence(newEvidence);
      }
    });

    setUploadDialogOpen(false);
  };

  const getEvidenceType = (filename: string): LiveUploadedFile['type'] => {
    const lower = filename.toLowerCase();
    if (lower.includes('medical') || lower.includes('hospital') || lower.includes('doctor')) {
      return 'medical';
    }
    if (lower.includes('photo') || lower.includes('image') || lower.match(/\.(jpg|jpeg|png|gif)$/)) {
      return 'photo';
    }
    if (lower.includes('insurance')) {
      return 'insurance';
    }
    if (lower.includes('police') || lower.includes('report')) {
      return 'police';
    }
    if (lower.includes('deposition') || lower.includes('testimony')) {
      return 'deposition';
    }
    return 'other';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Get files based on mode
  const files = mode === 'live' ? uploadedFiles : evidence;
  
  const filteredFiles = files.filter(item =>
    !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fileCount = files.length;
  const processingCount = mode === 'live' 
    ? uploadedFiles.filter(f => f.status === 'processing').length 
    : 0;

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-medium text-gray-900">Evidence</h2>
            <p className="text-[10px] text-muted-foreground">
              {fileCount} {fileCount === 1 ? 'file' : 'files'}
              {processingCount > 0 && (
                <span className="text-amber-600 ml-1">
                  ({processingCount} processing)
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleUploadClick}
            className="h-6 w-6 p-0 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-2 py-1.5 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            placeholder="Search files..."
            className="w-full pl-7 pr-2 h-7 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {fileCount === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <FolderOpen className="h-8 w-8 text-gray-300 mb-2" />
            <p className="text-xs font-medium text-gray-500 mb-1">No evidence files</p>
            <p className="text-[10px] text-gray-400">
              {mode === 'live' 
                ? isSessionActive 
                  ? 'Upload documents during your conversation'
                  : 'Start a conversation to collect evidence'
                : 'Click the upload button to add files'}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filteredFiles.map((item) => {
              // Handle both Evidence (mock) and LiveUploadedFile (live) types
              const isLiveFile = 'status' in item && typeof item.status === 'string' && 
                               (item.status === 'processing' || item.status === 'processed' || item.status === 'error');
              
              const status = isLiveFile 
                ? (item as LiveUploadedFile).status 
                : (item as Evidence).status;
              
              const uploadedAt = isLiveFile 
                ? (item as LiveUploadedFile).uploadedAt 
                : (item as Evidence).uploadedAt;
              
              const size = isLiveFile 
                ? (item as LiveUploadedFile).size 
                : (item as Evidence).size;

              const isHighlighted = highlightedFileId === item.id;
              
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!isLiveFile && onFileSelect) {
                      onFileSelect(item as Evidence);
                    }
                  }}
                  className={`flex items-center py-1 px-3 cursor-pointer text-sm transition-all ${
                    isHighlighted
                      ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset animate-pulse'
                      : selectedFileId === item.id
                        ? 'bg-gray-100'
                        : 'hover:bg-gray-50'
                  } ${status === 'processing' ? 'opacity-70' : ''}`}
                >
                  <div className="flex-shrink-0 mr-2">
                    {getFileIcon(status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-xs font-medium text-gray-900">
                      {item.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {status === 'processing' ? (
                        <span className="text-amber-600">Processing...</span>
                      ) : (
                        <>
                          {size} • {uploadedAt}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredFiles.length === 0 && searchQuery && (
              <div className="p-4 text-center text-muted-foreground text-xs">
                No files found matching your search.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUpload={handleUploadComplete}
      />
    </div>
  );
}
