'use client';

import { useLiveCase } from '@/contexts/live-case-context';

export default function LiveCaseSummaryView() {
  const { caseFacts, lastUpdatedField } = useLiveCase();
  
  const hasAnyData = Object.keys(caseFacts).length > 0;
  
  const isFieldUpdating = (field: string) => lastUpdatedField === `caseFacts.${field}`;

  if (!hasAnyData) {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-white">
        <div className="max-w-5xl mx-auto p-8 space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <div className="h-5 w-32 bg-gray-100 rounded animate-pulse"></div>
            <div className="h-3 w-24 bg-gray-100 rounded mt-2 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="h-2 w-16 bg-gray-100 rounded mb-2"></div>
                <div className="h-4 w-24 bg-gray-100 rounded animate-shimmer"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-white">
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-lg font-semibold text-gray-900">
            {caseFacts.incidentType || 'Case Intake'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">Information gathered during intake</p>
        </div>

        {/* Key Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          {caseFacts.plaintiffName && (
            <div className={`border border-gray-200 rounded-lg px-3 py-2 transition-all ${isFieldUpdating('plaintiffName') ? 'animate-fadeSlideIn' : ''}`}>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Plaintiff</div>
              <p className="text-sm font-medium text-gray-900">{caseFacts.plaintiffName}</p>
            </div>
          )}

          {caseFacts.incidentDate && (
            <div className={`border border-gray-200 rounded-lg px-3 py-2 transition-all ${isFieldUpdating('incidentDate') ? 'animate-fadeSlideIn' : ''}`}>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Incident Date</div>
              <p className="text-sm font-medium text-gray-900">{caseFacts.incidentDate}</p>
            </div>
          )}

          {caseFacts.incidentLocation && (
            <div className={`border border-gray-200 rounded-lg px-3 py-2 transition-all ${isFieldUpdating('incidentLocation') ? 'animate-fadeSlideIn' : ''}`}>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Location</div>
              <p className="text-sm font-medium text-gray-900">{caseFacts.incidentLocation}</p>
            </div>
          )}

          {caseFacts.employerName && (
            <div className={`border border-gray-200 rounded-lg px-3 py-2 transition-all ${isFieldUpdating('employerName') ? 'animate-fadeSlideIn' : ''}`}>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Employer</div>
              <p className="text-sm font-medium text-gray-900">{caseFacts.employerName}</p>
            </div>
          )}
        </div>

        {/* Incident Description */}
        {caseFacts.incidentDescription && (
          <div className={`border border-gray-200 rounded-lg transition-all ${isFieldUpdating('incidentDescription') ? 'animate-fadeSlideIn' : ''}`}>
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50 rounded-t-lg">
              <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Incident Description</h2>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-700 leading-relaxed">{caseFacts.incidentDescription}</p>
            </div>
          </div>
        )}

        {/* Injuries */}
        {caseFacts.injuries && caseFacts.injuries.length > 0 && (
          <div className={`border border-gray-200 rounded-lg transition-all ${isFieldUpdating('injuries') ? 'animate-fadeSlideIn' : ''}`}>
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50 rounded-t-lg">
              <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Injuries</h2>
            </div>
            <div className="p-4">
              {caseFacts.injurySeverity && (
                <div className="mb-3">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Severity: </span>
                  <span className="text-xs font-medium text-gray-900">{caseFacts.injurySeverity}</span>
                </div>
              )}
              <ul className="space-y-1">
                {caseFacts.injuries.map((injury, idx) => (
                  <li key={idx} className="text-xs text-gray-700">• {injury}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Financial Impact */}
        {(caseFacts.medicalExpenses || caseFacts.lostWages || caseFacts.daysMissedWork) && (
          <div className="border border-gray-200 rounded-lg">
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50 rounded-t-lg">
              <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Financial Impact</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-4">
                {caseFacts.medicalExpenses && (
                  <div className={isFieldUpdating('medicalExpenses') ? 'animate-fadeSlideIn' : ''}>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Medical Expenses</div>
                    <p className="text-sm font-semibold text-true-turquoise">${caseFacts.medicalExpenses.toLocaleString()}</p>
                  </div>
                )}
                {caseFacts.lostWages && (
                  <div className={isFieldUpdating('lostWages') ? 'animate-fadeSlideIn' : ''}>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Lost Wages</div>
                    <p className="text-sm font-semibold text-true-turquoise">${caseFacts.lostWages.toLocaleString()}</p>
                  </div>
                )}
                {caseFacts.daysMissedWork && (
                  <div className={isFieldUpdating('daysMissedWork') ? 'animate-fadeSlideIn' : ''}>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Days Missed</div>
                    <p className="text-sm font-medium text-gray-900">{caseFacts.daysMissedWork}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
