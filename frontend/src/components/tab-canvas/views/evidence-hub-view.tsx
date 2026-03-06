'use client';

import { useState, useRef } from 'react';
import { Upload, FileText } from 'lucide-react';
import { useEvidence } from '@/contexts/evidence-context';
import { type Evidence } from '@/lib/mock-data';
import { Checkbox } from '@/components/ui/checkbox';

export default function EvidenceHubView() {
  const { evidenceItems, evidence, addEvidenceItem, updateEvidenceItem, deleteEvidenceItem, addEvidence } = useEvidence();
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemNotes, setNewItemNotes] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  const handleAddItem = () => {
    if (!newItemTitle.trim()) return;

    const newItem = {
      id: Date.now().toString(),
      title: newItemTitle,
      notes: newItemNotes,
      dateAdded: new Date().toISOString().split('T')[0],
      completed: false,
    };

    addEvidenceItem(newItem);
    setNewItemTitle('');
    setNewItemNotes('');
    setIsAddingNew(false);
  };

  const handleToggleComplete = (id: string) => {
    const item = evidenceItems.find((i) => i.id === id);
    if (item) {
      updateEvidenceItem(id, { completed: !item.completed });
    }
  };

  const handleDeleteItem = (id: string) => {
    deleteEvidenceItem(id);
  };

  const handleFileUploadClick = (itemId: string) => {
    setUploadingItemId(itemId);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadingItemId) return;

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

    addEvidence(newEvidence);
    updateEvidenceItem(uploadingItemId, { evidenceId: newEvidence.id });

    setTimeout(() => {
      addEvidence({ ...newEvidence, status: 'processed' });
    }, 2000);

    setUploadingItemId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getEvidenceType = (filename: string): Evidence['type'] => {
    const lower = filename.toLowerCase();
    if (lower.includes('medical') || lower.includes('hospital') || lower.includes('doctor')) return 'medical';
    if (lower.includes('photo') || lower.includes('image') || lower.match(/\.(jpg|jpeg|png|gif)$/)) return 'photo';
    if (lower.includes('insurance')) return 'insurance';
    if (lower.includes('police') || lower.includes('report')) return 'police';
    if (lower.includes('deposition') || lower.includes('testimony')) return 'deposition';
    return 'medical';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getLinkedEvidence = (evidenceId?: string): Evidence | undefined => {
    return evidence.find((e) => e.id === evidenceId);
  };

  const completedCount = evidenceItems.filter((item) => item.completed).length;
  const withFilesCount = evidenceItems.filter((item) => item.evidenceId).length;

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

        {/* Add New Item */}
        {!isAddingNew ? (
          <button
            onClick={() => setIsAddingNew(true)}
            className="w-full px-4 py-3 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:border-gray-400 hover:text-gray-900 transition-colors"
          >
            + Add Evidence Item
          </button>
        ) : (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">New Evidence Item</div>
            <input
              type="text"
              placeholder="Title"
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <textarea
              placeholder="Notes"
              value={newItemNotes}
              onChange={(e) => setNewItemNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddItem}
                disabled={!newItemTitle.trim()}
                className="flex-1 py-2 px-4 bg-black text-white text-xs font-medium rounded-md hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Add Item
              </button>
              <button
                onClick={() => {
                  setIsAddingNew(false);
                  setNewItemTitle('');
                  setNewItemNotes('');
                }}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Evidence Items */}
        <div className="space-y-3">
          {evidenceItems.length === 0 ? (
            <div className="border border-gray-200 rounded-lg p-12 text-center">
              <FileText className="w-8 h-8 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">No evidence items yet</p>
              <p className="text-xs text-gray-400 mt-1">Add your first item to get started</p>
            </div>
          ) : (
            evidenceItems.map((item) => {
              const linkedEvidence = getLinkedEvidence(item.evidenceId);
              return (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => handleToggleComplete(item.id)}
                      className="mt-0.5"
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`text-sm font-semibold mb-2 ${
                          item.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                        }`}
                      >
                        {item.title}
                      </h3>
                      {item.notes && (
                        <p className="text-xs text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap">
                          {item.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span>
                          {new Date(item.dateAdded).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        {linkedEvidence && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="font-medium text-gray-900">
                              {linkedEvidence.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleFileUploadClick(item.id)}
                        className="px-2 py-1 text-[10px] font-medium text-gray-700 bg-white border border-gray-300 rounded hover:border-gray-400 hover:text-gray-900 transition-colors"
                        title={linkedEvidence ? 'Replace file' : 'Upload file'}
                      >
                        <Upload className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="px-2 py-1 text-[10px] font-medium text-gray-700 bg-white border border-gray-300 rounded hover:border-gray-400 hover:text-gray-900 transition-colors"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
