'use client';

import { mockCaseSummary } from '@/lib/mock-data';

export default function CaseSummaryView() {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-white">
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-lg font-semibold text-gray-900">{mockCaseSummary.caseId}</h1>
          <p className="text-xs text-gray-500 mt-1">{mockCaseSummary.incidentType}</p>
        </div>

        {/* Key Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-gray-200 p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Plaintiff</div>
            <p className="text-sm font-medium text-gray-900">{mockCaseSummary.plaintiffName}</p>
          </div>

          <div className="border border-gray-200 p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Incident Date</div>
            <p className="text-sm font-medium text-gray-900">{mockCaseSummary.incidentDate}</p>
          </div>

          <div className="border border-gray-200 p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</div>
            <p className="text-sm font-medium text-gray-900">{mockCaseSummary.status}</p>
          </div>

          <div className="border border-gray-200 p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Estimated Value</div>
            <p className="text-sm font-semibold text-gray-900">{mockCaseSummary.estimatedValue}</p>
          </div>
        </div>

        {/* Case Narrative */}
        <div className="border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Case Narrative</h2>
          <div className="prose prose-sm max-w-none">
            {mockCaseSummary.narrative.split('\n\n').map((paragraph, index) => (
              <p key={index} className="text-xs text-gray-700 leading-relaxed mb-3">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* Key Observations */}
        <div className="border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Key Observations</h2>
          <ul className="space-y-2 text-xs text-gray-700">
            <li className="flex items-start gap-2">
              <span className="font-bold mt-0.5">•</span>
              <span>Strong liability case with defendant's admission of fault</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold mt-0.5">•</span>
              <span>Medical documentation supports claimed injuries with objective findings</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold mt-0.5">•</span>
              <span>3 treatment gaps identified - explanations documented</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold mt-0.5">•</span>
              <span>Consistent treatment patterns indicate genuine injury progression</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
