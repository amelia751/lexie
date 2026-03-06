'use client';

import { type Evidence } from '@/lib/mock-data';
import { FileSearch, Upload } from 'lucide-react';
import { useEvidence } from '@/contexts/evidence-context';
import { useRef } from 'react';

interface FileExplorerProps {
  onFileSelect?: (evidence: Evidence) => void;
  selectedFileId?: string;
}

const getFileIcon = (type: Evidence['type']) => {
  return <FileSearch className="w-3.5 h-3.5 text-gray-600" />;
};

export default function FileExplorer({ onFileSelect, selectedFileId }: FileExplorerProps) {
  const { evidence, addEvidence } = useEvidence();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Create a new Evidence entry
    const newEvidence: Evidence = {
      id: `evidence-${Date.now()}`,
      name: file.name,
      type: getEvidenceType(file.name),
      uploadedAt: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      size: formatFileSize(file.size),
      status: 'processing',
    };

    // Add to evidence list
    addEvidence(newEvidence);

    // Simulate processing
    setTimeout(() => {
      // In a real app, you'd update this after actual processing
      addEvidence({ ...newEvidence, status: 'processed' });
    }, 2000);

    // Reset
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
      />

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-200">
        <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Evidence</h2>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {evidence.length} files
        </p>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-2 space-y-px">
          {evidence.map((item) => (
            <button
              key={item.id}
              onClick={() => onFileSelect?.(item)}
              className={`w-full text-left px-3 py-2 border rounded-md transition-colors ${
                selectedFileId === item.id
                  ? 'bg-gray-50 border-gray-900'
                  : 'bg-white border-transparent hover:border-gray-200'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  {getFileIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900 truncate">
                    {item.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-gray-500">{item.size}</span>
                    <span className="text-[10px] text-gray-400">•</span>
                    <span className="text-[10px] text-gray-500">{item.uploadedAt}</span>
                  </div>
                  {item.status === 'processing' && (
                    <div className="mt-1">
                      <span className="text-[10px] text-blue-600 animate-pulse">Processing...</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-2.5 border-t border-gray-200">
        <button
          onClick={handleUploadClick}
          className="w-full px-3 py-1.5 text-xs font-medium text-white bg-black border border-black rounded-md hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
        >
          <Upload className="w-3 h-3" />
          Upload
        </button>
      </div>
    </div>
  );
}
