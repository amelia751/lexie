'use client';

import { useLiveCase } from '@/contexts/live-case-context';

export default function LiveMedicalView() {
  const { medicalRecords, caseFacts, lastUpdatedField } = useLiveCase();
  
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

  if (!hasAnyData) {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-white">
        <div className="max-w-5xl mx-auto p-8 space-y-6">
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
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-lg font-semibold text-true-turquoise">Medical Summary</h1>
          <p className="text-xs text-gray-500 mt-1">Treatment records and medical expenses</p>
        </div>

        {/* Injuries */}
        {caseFacts.injuries && caseFacts.injuries.length > 0 && (
          <div className={`border border-gray-200 rounded-lg ${lastUpdatedField?.includes('injuries') ? 'animate-fadeSlideIn' : ''}`}>
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50 rounded-t-lg">
              <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Documented Injuries</h2>
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

        {/* Medical Records Table */}
        {medicalRecords.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
              <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Treatment Records</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Provider</th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Service</th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Diagnosis</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {medicalRecords.map((record) => (
                    <tr
                      key={record.id}
                      className={`text-xs transition-all ${isRecordUpdating(record.id) ? 'animate-fadeSlideIn' : ''}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {new Date(record.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{record.provider}</td>
                      <td className="px-4 py-3 text-gray-700">{record.service}</td>
                      <td className="px-4 py-3 text-gray-600">{record.diagnosis || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(record.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-900">TOTAL</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-true-turquoise">
                      {formatCurrency(totalMedicalExpenses)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
