'use client';

import { useState } from 'react';
import { mockDamages } from '@/lib/mock-data';
import { Slider } from '@/components/ui/slider';

export default function DamagesView() {
  const [selectedScenario, setSelectedScenario] = useState<'worst' | 'base' | 'best'>('base');
  const [contingencyFee, setContingencyFee] = useState(33);
  const [trialCosts, setTrialCosts] = useState(15000);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const scenarios = {
    worst: {
      medical: mockDamages.medicalExpenses * 0.85,
      wages: mockDamages.lostWages * 0.70,
      painSuffering: mockDamages.painAndSuffering * 0.60,
      probability: 55,
    },
    base: {
      medical: mockDamages.medicalExpenses,
      wages: mockDamages.lostWages,
      painSuffering: mockDamages.painAndSuffering,
      probability: mockDamages.probability,
    },
    best: {
      medical: mockDamages.medicalExpenses * 1.10,
      wages: mockDamages.lostWages * 1.15,
      painSuffering: mockDamages.painAndSuffering * 1.40,
      probability: 85,
    },
  };

  const currentScenario = scenarios[selectedScenario];
  const currentTotal = currentScenario.medical + currentScenario.wages + currentScenario.painSuffering;
  const netRecovery = currentTotal - (currentTotal * (contingencyFee / 100)) - trialCosts;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-white">
      <div className="max-w-6xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-lg font-semibold text-gray-900">Damages Analysis</h1>
          <p className="text-xs text-gray-500 mt-1">Financial valuation and settlement analysis</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-gray-200 p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Exposure</div>
            <div className="text-lg font-semibold text-gray-900">{formatCurrency(currentTotal)}</div>
          </div>
          <div className="border border-gray-200 p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Settlement Target</div>
            <div className="text-lg font-semibold text-gray-900">{formatCurrency((mockDamages.settlementRange.low + mockDamages.settlementRange.high) / 2)}</div>
          </div>
          <div className="border border-gray-200 p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Success Rate</div>
            <div className="text-lg font-semibold text-gray-900">{currentScenario.probability}%</div>
          </div>
          <div className="border border-gray-200 p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Economic Damages</div>
            <div className="text-lg font-semibold text-gray-900">{formatCurrency(currentScenario.medical + currentScenario.wages)}</div>
          </div>
        </div>

        {/* Damages Breakdown Table */}
        <div className="border border-gray-200">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Damages Breakdown</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Category</th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="text-xs">
                <td className="px-4 py-3 text-gray-900">Medical Expenses</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.medical)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{((currentScenario.medical / currentTotal) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="text-xs">
                <td className="px-4 py-3 text-gray-900">Lost Wages</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.wages)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{((currentScenario.wages / currentTotal) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="text-xs">
                <td className="px-4 py-3 text-gray-900">Pain & Suffering</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.painSuffering)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{((currentScenario.painSuffering / currentTotal) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                <td className="px-4 py-3 text-sm text-gray-900">TOTAL DAMAGES</td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">{formatCurrency(currentTotal)}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Scenario Analysis */}
        <div className="border border-gray-200">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Scenario Analysis</h2>
          </div>
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Select Scenario:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedScenario('worst')}
                  className={`px-3 py-1 text-[10px] font-medium border transition-colors uppercase ${
                    selectedScenario === 'worst'
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Worst Case
                </button>
                <button
                  onClick={() => setSelectedScenario('base')}
                  className={`px-3 py-1 text-[10px] font-medium border transition-colors uppercase ${
                    selectedScenario === 'base'
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Base Case
                </button>
                <button
                  onClick={() => setSelectedScenario('best')}
                  className={`px-3 py-1 text-[10px] font-medium border transition-colors uppercase ${
                    selectedScenario === 'best'
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Best Case
                </button>
              </div>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Component</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">Worst Case</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">Base Case</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">Best Case</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-xs">
                <tr>
                  <td className="px-4 py-2 text-gray-900">Medical</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.worst.medical)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(scenarios.base.medical)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.best.medical)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Wages</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.worst.wages)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(scenarios.base.wages)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.best.wages)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Pain & Suffering</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.worst.painSuffering)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(scenarios.base.painSuffering)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.best.painSuffering)}</td>
                </tr>
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-gray-900">Total</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(scenarios.worst.medical + scenarios.worst.wages + scenarios.worst.painSuffering)}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(scenarios.base.medical + scenarios.base.wages + scenarios.base.painSuffering)}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(scenarios.best.medical + scenarios.best.wages + scenarios.best.painSuffering)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Client Net Recovery Calculator */}
        <div className="border border-gray-200">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Client Net Recovery Calculator</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-200">
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 uppercase mb-2">
                  Contingency Fee: {contingencyFee}%
                </label>
                <Slider
                  min={25}
                  max={40}
                  step={1}
                  value={[contingencyFee]}
                  onValueChange={(values) => setContingencyFee(values[0])}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 uppercase mb-2">
                  Trial Costs: {formatCurrency(trialCosts)}
                </label>
                <Slider
                  min={5000}
                  max={50000}
                  step={5000}
                  value={[trialCosts]}
                  onValueChange={(values) => setTrialCosts(values[0])}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-700">Gross Recovery</span>
                <span className="font-semibold text-gray-900">{formatCurrency(currentTotal)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-700">Less: Attorney Fees ({contingencyFee}%)</span>
                <span className="text-gray-600">-{formatCurrency(currentTotal * (contingencyFee / 100))}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-700">Less: Trial Costs</span>
                <span className="text-gray-600">-{formatCurrency(trialCosts)}</span>
              </div>
              <div className="flex justify-between py-3 border-2 border-gray-900 bg-gray-50 px-3">
                <span className="font-semibold text-gray-900">Client Net Recovery</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(netRecovery)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Settlement Range */}
        <div className="border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Settlement Valuation Range</h2>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Conservative</div>
              <div className="text-lg font-semibold text-gray-900">{formatCurrency(mockDamages.settlementRange.low)}</div>
              <div className="text-[10px] text-gray-500 mt-1">Minimum settlement</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Target</div>
              <div className="text-lg font-semibold text-gray-900">{formatCurrency((mockDamages.settlementRange.low + mockDamages.settlementRange.high) / 2)}</div>
              <div className="text-[10px] text-gray-500 mt-1">Recommended demand</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Optimistic</div>
              <div className="text-lg font-semibold text-gray-900">{formatCurrency(mockDamages.settlementRange.high)}</div>
              <div className="text-[10px] text-gray-500 mt-1">Maximum settlement</div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Settlement Recommendations</h2>
          <ul className="space-y-2 text-xs text-gray-700">
            <li>• Initial demand: {formatCurrency(mockDamages.settlementRange.high)}</li>
            <li>• Accept offers above {formatCurrency(95000)} to avoid trial costs</li>
            <li>• Leverage defendant's admission of fault in negotiations</li>
            <li>• Pain & suffering multiplier of 1.76x applied based on comparable cases</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
