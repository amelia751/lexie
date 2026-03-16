'use client';

import {
  FileSearch,
  History,
  Microscope,
  HatGlasses,
  FolderOpen,
} from 'lucide-react';
import LiveCaseSummaryView from './views/live-case-summary-view';
import LiveTimelineView from './views/live-timeline-view';
import LiveDamagesView from './views/live-damages-view';
import LiveMedicalView from './views/live-medical-view';
import LiveEvidenceView from './views/live-evidence-view';
import { useLiveCase, TabType } from '@/contexts/live-case-context';

interface Tab {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'summary', label: 'Case Summary', icon: <FileSearch className="w-4 h-4" /> },
  { id: 'timeline', label: 'Timeline', icon: <History className="w-4 h-4" /> },
  { id: 'medical', label: 'Medical Summary', icon: <Microscope className="w-4 h-4" /> },
  { id: 'damages', label: 'Damages Analysis', icon: <HatGlasses className="w-4 h-4" /> },
  { id: 'evidence', label: 'Evidence Hub', icon: <FolderOpen className="w-4 h-4" /> },
];

export default function TabCanvas() {
  const { 
    isSessionActive, 
    hasLiveData,
    activeTab, 
    openTabs, 
    setActiveTab, 
    lastUpdatedTab,
  } = useLiveCase();
  
  const handleTabClick = (tabId: TabType) => {
    setActiveTab(tabId);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return <LiveCaseSummaryView />;
      case 'timeline':
        return <LiveTimelineView />;
      case 'damages':
        return <LiveDamagesView />;
      case 'medical':
        return <LiveMedicalView />;
      case 'evidence':
        return <LiveEvidenceView />;
      default:
        return <EmptyCanvasState />;
    }
  };

  // Show empty state when no tabs are open yet
  if (openTabs.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white">
        <EmptyCanvasState />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Tab Bar */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center px-2 gap-1 overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => {
            const isOpen = openTabs.includes(tab.id);
            const isActive = activeTab === tab.id;
            const isUpdating = lastUpdatedTab === tab.id && isSessionActive;

            // Only show open tabs
            if (!isOpen) {
              return null;
            }

            return (
              <div
                key={tab.id}
                className={`group flex items-center gap-2 px-4 py-2 text-xs font-medium transition-all border-b-2 cursor-pointer relative ${
                  isActive
                    ? 'border-true-turquoise text-true-turquoise bg-white'
                    : 'border-transparent text-gray-600 hover:text-true-turquoise hover:bg-gray-50'
                }`}
                onClick={() => handleTabClick(tab.id)}
              >
                {/* Update indicator - subtle dot */}
                {isUpdating && !isActive && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-true-turquoise"></span>
                )}
                
                {tab.icon}
                <span className="whitespace-nowrap">{tab.label}</span>
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

function EmptyCanvasState() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-white">
      <div className="text-center max-w-sm px-8">
        <div className="w-12 h-12 mx-auto mb-4 border border-gray-200 rounded-lg flex items-center justify-center">
          <FileSearch className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Ready for Intake</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          Start a voice session to begin. Case details will populate here as information is gathered.
        </p>
      </div>
    </div>
  );
}
