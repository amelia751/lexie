'use client';

import { type Evidence } from '@/lib/mock-data';
import { File, Upload, Search, Loader2 } from 'lucide-react';
import { useEvidence } from '@/contexts/evidence-context';
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

const getFileIcon = (type: Evidence['type'], status?: string) => {
  if (status === 'processing') {
    return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />;
  }
  return <File className="h-4 w-4 text-muted-foreground" />;
};

export default function FileExplorer({ onFileSelect, selectedFileId }: FileExplorerProps) {
  const { evidence, addEvidence } = useEvidence();
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const handleUploadClick = () => {
    setUploadDialogOpen(true);
  };

  const handleUploadComplete = (uploadedFiles: UploadedFile[]) => {
    uploadedFiles.forEach(uploadedFile => {
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
    });

    setUploadDialogOpen(false);
  };

  const getEvidenceType = (filename: string): Evidence['type'] => {
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
    return 'medical'; // default
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const filteredEvidence = evidence.filter(item =>
    !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-medium text-gray-900">Evidence</h2>
            <p className="text-[10px] text-muted-foreground">
              {evidence.length} files
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
        <div className="py-1">
          {filteredEvidence.map((item) => (
            <div
              key={item.id}
              onClick={() => onFileSelect?.(item)}
              className={`flex items-center py-1 px-3 cursor-pointer text-sm transition-colors ${
                selectedFileId === item.id
                  ? 'bg-gray-100'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex-shrink-0 mr-2">
                {getFileIcon(item.type, item.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-xs font-medium text-gray-900">
                  {item.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.size} • {item.uploadedAt}
                </div>
              </div>
            </div>
          ))}
          {filteredEvidence.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-xs">
              {searchQuery ? 'No files found matching your search.' : 'No files uploaded yet.'}
            </div>
          )}
        </div>
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
