'use client';

import { useState } from 'react';
import {
  FileText,
  History,
  Microscope,
  HatGlasses,
  X,
} from 'lucide-react';
import CaseSummaryView from './views/case-summary-view';
import TimelineView from './views/timeline-view';
import DamagesView from './views/damages-view';
import MedicalSummaryView from './views/medical-summary-view';

type TabType = 'summary' | 'timeline' | 'damages' | 'medical';

interface Tab {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'summary', label: 'Case Summary', icon: <FileText className="w-4 h-4" /> },
  { id: 'timeline', label: 'Timeline', icon: <History className="w-4 h-4" /> },
  { id: 'medical', label: 'Medical Summary', icon: <Microscope className="w-4 h-4" /> },
  { id: 'damages', label: 'Damages Analysis', icon: <HatGlasses className="w-4 h-4" /> },
];

export default function TabCanvas() {
  const [openTabs, setOpenTabs] = useState<TabType[]>(['summary']);
  const [activeTab, setActiveTab] = useState<TabType>('summary');

  const handleTabClick = (tabId: TabType) => {
    if (!openTabs.includes(tabId)) {
      setOpenTabs([...openTabs, tabId]);
    }
    setActiveTab(tabId);
  };

  const handleCloseTab = (tabId: TabType, e: React.MouseEvent) => {
    e.stopPropagation();
    const newOpenTabs = openTabs.filter(id => id !== tabId);
    setOpenTabs(newOpenTabs);

    if (activeTab === tabId && newOpenTabs.length > 0) {
      setActiveTab(newOpenTabs[newOpenTabs.length - 1]);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return <CaseSummaryView />;
      case 'timeline':
        return <TimelineView />;
      case 'damages':
        return <DamagesView />;
      case 'medical':
        return <MedicalSummaryView />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Tab Bar */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center px-2 gap-1 overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => {
            const isOpen = openTabs.includes(tab.id);
            const isActive = activeTab === tab.id;

            return (
              <div
                key={tab.id}
                className={`group flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors border-b cursor-pointer ${
                  isActive
                    ? 'border-black text-black bg-white'
                    : isOpen
                    ? 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => handleTabClick(tab.id)}
              >
                {tab.icon}
                <span className="whitespace-nowrap">{tab.label}</span>
                {isOpen && openTabs.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="ml-2 p-0.5 hover:bg-gray-200 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {renderTabContent()}
      </div>
    </div>
  );
}
