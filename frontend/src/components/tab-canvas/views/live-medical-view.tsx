'use client';

import { useState } from 'react';
import { useLiveCase } from '@/contexts/live-case-context';
import EvidenceViewer from '@/components/evidence-viewer/evidence-viewer';

export default function LiveMedicalView() {
  const { medicalRecords, caseFacts, lastUpdatedField } = useLiveCase();
  const [viewingEvidence, setViewingEvidence] = useState<{ source: string; url: string; type: 'pdf' | 'image' } | null>(null);
  
  const hasAnyData = medicalRecords.length > 0 || caseFacts.injuries?.length;
  
  const isRecordUpdating = (id: string) => lastUpdatedField === `medical.${id}`;

  const totalMedicalExpenses = medicalRecords.reduce((sum, r) => sum + r.amount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleViewSource = (provider: string) => {
    // Mock evidence URLs based on provider type
    const isImaging = provider.toLowerCase().includes('radiology') || provider.toLowerCase().includes('imaging');
    setViewingEvidence({
      source: provider,
      url: isImaging 
        ? 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&h=600&fit=crop'
        : '/sample.pdf',
      type: isImaging ? 'image' : 'pdf',
    });
  };

  if (!hasAnyData) {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-white">
        <div className="max-w-6xl mx-auto p-8 space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <div className="h-5 w-40 bg-gray-100 rounded animate-pulse"></div>
            <div className="h-3 w-56 bg-gray-100 rounded mt-2 animate-pulse"></div>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="h-3 w-24 bg-gray-100 rounded"></div>
            </div>
            <div className="p-4">
              <div className="h-24 bg-gray-100 rounded animate-shimmer"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-white">
      <div className="max-w-6xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-lg font-semibold text-gray-900">Medical Summary Report</h1>
          <p className="text-xs text-gray-500 mt-1">
            {caseFacts.incidentType || 'Case'} • {caseFacts.incidentDate || 'Intake in progress'}
          </p>
        </div>

        {/* Injuries & Diagnoses */}
        {caseFacts.injuries && caseFacts.injuries.length > 0 && (
          <div className={`border border-gray-200 rounded-lg overflow-hidden ${lastUpdatedField?.includes('injuries') ? 'animate-fadeSlideIn' : ''}`}>
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
              <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Primary Diagnoses</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">ICD-10</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Diagnosis</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Severity</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {caseFacts.injuries.map((injury, idx) => (
                  <tr key={idx} className="text-xs">
                    <td className="px-4 py-3 font-mono text-gray-900">
                      {injury.includes('vertebrae') ? 'S22.0' : injury.includes('trauma') ? 'S39.92' : 'S34.3'}
                    </td>
                    <td className="px-4 py-3 text-gray-900">{injury}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 border rounded text-[10px] ${
                        caseFacts.injurySeverity === 'severe' 
                          ? 'border-gray-400 text-gray-700' 
                          : 'border-gray-300 text-gray-600'
                      }`}>
                        {caseFacts.injurySeverity || 'Moderate'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">Under treatment</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Itemized Medical Billing */}
        {medicalRecords.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
              <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Itemized Medical Billing</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Provider</th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Service</th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">CPT</th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">ICD-10</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Source</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {medicalRecords.map((record) => (
                    <tr
                      key={record.id}
                      className={`text-[11px] transition-all ${isRecordUpdating(record.id) ? 'animate-fadeSlideIn' : ''}`}
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                        {new Date(record.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2 text-gray-900">{record.provider}</td>
                      <td className="px-4 py-2 text-gray-700">{record.service}</td>
                      <td className="px-4 py-2 text-gray-600 font-mono text-[10px]">
                        {record.service.includes('X-Ray') ? '72040' : 
                         record.service.includes('CT') ? '72125' :
                         record.service.includes('Emergency') ? '99285' : '99214'}
                      </td>
                      <td className="px-4 py-2 text-gray-600 font-mono text-[10px]">
                        {record.diagnosis?.includes('vertebr') ? 'S22.0' : 
                         record.diagnosis?.includes('fracture') ? 'S32.0' : 'S39.92'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900 font-semibold">{formatCurrency(record.amount)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="px-2 py-0.5 text-[10px] border border-gray-300 rounded text-gray-600">Billed</span>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleViewSource(record.provider)}
                          className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr className="font-semibold border-t-2 border-gray-300">
                    <td colSpan={5} className="px-4 py-2 text-xs text-gray-900">TOTAL PAST MEDICAL EXPENSES</td>
                    <td className="px-4 py-2 text-right text-sm text-true-turquoise">{formatCurrency(totalMedicalExpenses)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Future Medical (placeholder) */}
        {medicalRecords.length > 0 && (
          <div className="border border-gray-200 rounded-lg">
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50 rounded-t-lg">
              <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Future Medical Expenses (Estimate)</h2>
            </div>
            <div className="p-4">
              <div className="text-xs text-gray-500 italic">
                Future medical expense estimates will be calculated once treatment records are fully processed.
              </div>
            </div>
          </div>
        )}
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
