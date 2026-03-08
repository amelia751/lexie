'use client';

import { useLiveCase } from '@/contexts/live-case-context';

export default function LiveDamagesView() {
  const { damagesEstimate, caseFacts, medicalRecords, lastUpdatedField } = useLiveCase();
  
  const hasCalculation = damagesEstimate.calculatedAt !== undefined;
  
  const pastMedical = damagesEstimate.pastMedical ?? caseFacts.medicalExpenses ?? medicalRecords.reduce((sum, r) => sum + r.amount, 0);
  const lostWages = damagesEstimate.lostWages ?? caseFacts.lostWages ?? 0;
  const futureMedical = damagesEstimate.futureMedical ?? 0;
  const painAndSuffering = damagesEstimate.painAndSuffering ?? 0;
  
  const economicDamages = pastMedical + futureMedical + lostWages;
  const totalDamages = economicDamages + painAndSuffering;
  
  const settlementLow = damagesEstimate.settlementLow ?? Math.round(totalDamages * 0.6);
  const settlementHigh = damagesEstimate.settlementHigh ?? Math.round(totalDamages * 0.85);
  
  const hasAnyData = pastMedical > 0 || lostWages > 0 || hasCalculation;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!hasAnyData) {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-white">
        <div className="max-w-5xl mx-auto p-8 space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <div className="h-5 w-40 bg-gray-100 rounded animate-pulse"></div>
            <div className="h-3 w-56 bg-gray-100 rounded mt-2 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="h-2 w-16 bg-gray-100 rounded mb-2"></div>
                <div className="h-6 w-24 bg-gray-100 rounded animate-shimmer"></div>
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
          <h1 className="text-lg font-semibold text-true-turquoise">Damages Analysis</h1>
          <p className="text-xs text-gray-500 mt-1">Financial valuation and settlement estimate</p>
        </div>

        {/* Settlement Range */}
        <div className={`border border-gray-200 rounded-lg p-6 ${lastUpdatedField === 'damages' ? 'animate-fadeSlideIn' : ''}`}>
          <h2 className="text-sm font-semibold text-peacock mb-4 uppercase tracking-wide">Estimated Settlement Range</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Low</div>
              <div className="text-xl font-semibold text-gray-700">{formatCurrency(settlementLow)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Target</div>
              <div className="text-2xl font-bold text-true-turquoise">{formatCurrency(Math.round((settlementLow + settlementHigh) / 2))}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">High</div>
              <div className="text-xl font-semibold text-gray-700">{formatCurrency(settlementHigh)}</div>
            </div>
          </div>
        </div>

        {/* Damages Breakdown */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Damages Breakdown</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Category</th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="bg-gray-50">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">Economic Damages</td>
              </tr>
              <tr className="text-xs">
                <td className="px-4 py-3 text-gray-700 pl-8">Past Medical Expenses</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(pastMedical)}</td>
              </tr>
              <tr className="text-xs">
                <td className="px-4 py-3 text-gray-700 pl-8">Future Medical Expenses</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(futureMedical)}</td>
              </tr>
              <tr className="text-xs">
                <td className="px-4 py-3 text-gray-700 pl-8">Lost Wages</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(lostWages)}</td>
              </tr>
              <tr className="bg-gray-50 text-xs font-semibold">
                <td className="px-4 py-2 text-gray-900 pl-8">Subtotal Economic</td>
                <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(economicDamages)}</td>
              </tr>
              
              <tr className="bg-gray-50">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">Non-Economic Damages</td>
              </tr>
              <tr className="text-xs">
                <td className="px-4 py-3 text-gray-700 pl-8">
                  Pain & Suffering
                  {painAndSuffering > 0 && pastMedical > 0 && (
                    <span className="ml-2 text-[10px] text-gray-500">
                      ({(painAndSuffering / pastMedical).toFixed(1)}x multiplier)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(painAndSuffering)}</td>
              </tr>
              
              <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                <td className="px-4 py-3 text-sm text-gray-900">TOTAL DAMAGES</td>
                <td className="px-4 py-3 text-right text-lg text-true-turquoise">{formatCurrency(totalDamages)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Note */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-semibold">Note:</span> These estimates are preliminary and based on information gathered during intake. Final valuations require complete evidence review and jurisdiction-specific analysis.
          </p>
        </div>
      </div>
    </div>
  );
}
