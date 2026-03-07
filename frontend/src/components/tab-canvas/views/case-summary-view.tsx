'use client';

import { mockCaseSummary } from '@/lib/mock-data';

export default function CaseSummaryView() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-white">
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-lg font-semibold text-true-turquoise">{mockCaseSummary.caseId}</h1>
          <p className="text-xs text-gray-500 mt-1">{mockCaseSummary.incidentType}</p>
        </div>

        {/* Key Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Plaintiff</div>
            <p className="text-sm font-medium text-gray-900">{mockCaseSummary.plaintiffName}</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Incident Date</div>
            <p className="text-sm font-medium text-gray-900">{mockCaseSummary.incidentDate}</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</div>
            <p className="text-sm font-medium text-gray-900">{mockCaseSummary.status}</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Estimated Value</div>
            <p className="text-sm font-semibold text-true-turquoise">{mockCaseSummary.estimatedValue}</p>
          </div>
        </div>

        {/* Defendant & Insurance Info */}
        <div className="border border-gray-200 rounded-lg">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50 rounded-t-lg">
            <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Defendant & Insurance</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Defendant</div>
                <p className="text-sm font-medium text-gray-900">{mockCaseSummary.defendant.name}</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Insurance Carrier</div>
                <p className="text-sm font-medium text-gray-900">{mockCaseSummary.defendant.insuranceCarrier}</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Policy Number</div>
                <p className="text-sm font-mono text-gray-900">{mockCaseSummary.defendant.policyNumber}</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Policy Limits (BI/Accident)</div>
                <p className="text-sm font-semibold text-true-turquoise">
                  {formatCurrency(mockCaseSummary.defendant.policyLimits.bodilyInjury)} / {formatCurrency(mockCaseSummary.defendant.policyLimits.perAccident)}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Adjuster Contact</div>
              <div className="text-xs text-gray-700">
                <span className="font-medium">{mockCaseSummary.defendant.adjusterName}</span> • {mockCaseSummary.defendant.adjusterPhone} • {mockCaseSummary.defendant.adjusterEmail}
              </div>
            </div>
          </div>
        </div>

        {/* Jurisdiction & Liability */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Jurisdiction</div>
            <p className="text-sm font-medium text-gray-900">{mockCaseSummary.jurisdiction.venue}</p>
            <p className="text-xs text-gray-600">{mockCaseSummary.jurisdiction.county}, {mockCaseSummary.jurisdiction.state}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Comparative Fault</div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-lg font-bold text-gray-900">{mockCaseSummary.comparativeFault.plaintiffFault}%</span>
                <span className="text-xs text-gray-500 ml-1">Plaintiff</span>
              </div>
              <div>
                <span className="text-lg font-bold text-gray-900">{mockCaseSummary.comparativeFault.defendantFault}%</span>
                <span className="text-xs text-gray-500 ml-1">Defendant</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">{mockCaseSummary.comparativeFault.analysis}</p>
          </div>
        </div>

        {/* Case Narrative */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-peacock mb-4 uppercase tracking-wide">Case Narrative</h2>
          <div className="prose prose-sm max-w-none">
            {mockCaseSummary.narrative.split('\n\n').map((paragraph, index) => (
              <p key={index} className="text-xs text-gray-700 leading-relaxed mb-3">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
