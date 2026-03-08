'use client';

import { useRef, useState } from 'react';
import { useLiveCase } from '@/contexts/live-case-context';
import { Upload, Clock, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import EvidenceViewer from '@/components/evidence-viewer/evidence-viewer';

export default function LiveEvidenceView() {
  const { evidenceItems, lastUpdatedField, updateEvidenceStatus } = useLiveCase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingItemIdRef = useRef<string | null>(null);
  const [viewingEvidence, setViewingEvidence] = useState<{ source: string; url: string; type: 'pdf' | 'image' } | null>(null);
  
  const hasAnyData = evidenceItems.length > 0;
  
  const isItemUpdating = (id: string) => lastUpdatedField === `evidence.${id}`;

  // Sort by priority: critical first, then important, then helpful
  const sortedItems = [...evidenceItems].sort((a, b) => {
    const priorityOrder = { critical: 0, important: 1, helpful: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Count stats
  const uploadedCount = evidenceItems.filter(item => item.status === 'uploaded').length;
  const pendingCount = evidenceItems.filter(item => item.status === 'pending').length;
  const notAvailableCount = evidenceItems.filter(item => item.status === 'not_available').length;

  const handleFileUploadClick = (itemId: string) => {
    uploadingItemIdRef.current = itemId;
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && uploadingItemIdRef.current) {
      updateEvidenceStatus(uploadingItemIdRef.current, 'uploaded');
      uploadingItemIdRef.current = null;
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleMarkNotAvailable = (itemId: string) => {
    updateEvidenceStatus(itemId, 'not_available');
  };

  const handleViewFile = (item: typeof evidenceItems[0]) => {
    // Mock evidence files - in real app would use actual uploaded file URLs
    const mockFileUrl = item.type.includes('photo') 
      ? 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop'
      : '/sample.pdf';
    const fileType = item.type.includes('photo') ? 'image' : 'pdf';
    
    setViewingEvidence({
      source: item.description,
      url: mockFileUrl,
      type: fileType as 'pdf' | 'image',
    });
  };

  const getFileName = (item: typeof evidenceItems[0]) => {
    // Generate a readable filename from the type
    const baseName = item.type.replace(/_/g, '-');
    const ext = item.type.includes('photo') ? '.jpg' : '.pdf';
    return baseName + ext;
  };

  if (!hasAnyData) {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-white">
        <div className="max-w-5xl mx-auto p-8 space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <div className="h-5 w-32 bg-gray-100 rounded animate-pulse"></div>
            <div className="h-3 w-48 bg-gray-100 rounded mt-2 animate-pulse"></div>
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <div className="w-4 h-4 bg-gray-100 rounded mt-0.5"></div>
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-gray-100 rounded mb-2 animate-shimmer"></div>
                    <div className="h-3 w-32 bg-gray-100 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isCompleted = (status: string) => {
    return status === 'uploaded' || status === 'not_available';
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-white">
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
        />

        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-lg font-semibold text-gray-900">Evidence Hub</h1>
          <p className="text-xs text-gray-500 mt-1">Track evidence items and manage supporting documents</p>
        </div>

        {/* Stats */}
        {evidenceItems.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span>{evidenceItems.length} items</span>
            {uploadedCount > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-gray-700">{uploadedCount} uploaded</span>
              </>
            )}
            {pendingCount > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-gray-600">{pendingCount} pending</span>
              </>
            )}
            {notAvailableCount > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-gray-500">{notAvailableCount} not available</span>
              </>
            )}
          </div>
        )}

        {/* Evidence Items */}
        <div className="space-y-3">
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className={`border border-gray-200 rounded-lg p-4 transition-all ${isItemUpdating(item.id) ? 'animate-fadeSlideIn' : ''}`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <Checkbox
                  checked={isCompleted(item.status)}
                  disabled
                  className="mt-0.5"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold mb-2 ${
                    isCompleted(item.status) ? 'text-gray-500 line-through' : 'text-gray-900'
                  }`}>
                    {item.description}
                  </h3>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span className="capitalize">{item.type.replace(/_/g, ' ')}</span>
                    <span className="text-gray-300">•</span>
                    <span className={`capitalize ${
                      item.priority === 'critical' ? 'text-gray-700 font-medium' : ''
                    }`}>
                      {item.priority}
                    </span>
                    
                    {/* Clickable file source - same style as timeline Source button */}
                    {item.status === 'uploaded' && (
                      <>
                        <span className="text-gray-300">•</span>
                        <button
                          onClick={() => handleViewFile(item)}
                          className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                        >
                          {getFileName(item)}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Badge or Actions */}
                <div className="flex items-center gap-2">
                  {/* Pending tag */}
                  {item.status === 'pending' && (
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-medium border-amber-700 text-amber-700 bg-amber-50/30">
                      <Clock className="w-3 h-3" />
                      Will provide later
                    </span>
                  )}
                  
                  {/* Not available tag */}
                  {item.status === 'not_available' && (
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-medium border-gray-300 text-gray-600 bg-gray-50">
                      Not available
                    </span>
                  )}
                  
                  {/* Upload button */}
                  <button
                    onClick={() => handleFileUploadClick(item.id)}
                    className="px-2 py-1 text-[10px] font-medium text-gray-700 bg-white border border-gray-300 rounded hover:border-gray-400 hover:text-gray-900 transition-colors"
                    title={item.status === 'uploaded' ? 'Replace file' : 'Upload file'}
                  >
                    <Upload className="w-3 h-3" />
                  </button>
                  
                  {/* X button - mark as not available */}
                  <button
                    onClick={() => handleMarkNotAvailable(item.id)}
                    className="px-2 py-1 text-[10px] font-medium text-gray-700 bg-white border border-gray-300 rounded hover:border-gray-400 hover:text-gray-900 transition-colors"
                    title="Mark as not available"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evidence Viewer Modal */}
      {viewingEvidence && (
        <EvidenceViewer
          source={viewingEvidence.source}
          url={viewingEvidence.url}
          type={viewingEvidence.type}
          onClose={() => setViewingEvidence(null)}
        />
      )}
    </div>
  );
}
