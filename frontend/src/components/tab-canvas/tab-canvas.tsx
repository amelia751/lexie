'use client';

import { useState } from 'react';
import {
  FileSearch,
  History,
  Microscope,
  HatGlasses,
  FolderOpen,
  X,
} from 'lucide-react';
import CaseSummaryView from './views/case-summary-view';
import TimelineView from './views/timeline-view';
import DamagesView from './views/damages-view';
import MedicalSummaryView from './views/medical-summary-view';
import EvidenceHubView from './views/evidence-hub-view';
import LiveCaseSummaryView from './views/live-case-summary-view';
import LiveTimelineView from './views/live-timeline-view';
import LiveDamagesView from './views/live-damages-view';
import LiveMedicalView from './views/live-medical-view';
import LiveEvidenceView from './views/live-evidence-view';
import { useLiveCase, TabType } from '@/contexts/live-case-context';
import { useEvidence } from '@/contexts/evidence-context';

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
  
  const { mode: evidenceMode } = useEvidence();
  
  // Local state for non-live mode tab management
  const [localOpenTabs, setLocalOpenTabs] = useState<TabType[]>(['summary']);
  const [localActiveTab, setLocalActiveTab] = useState<TabType>('summary');
  
  // Show live views if session is active OR if there's live data from a completed session
  const showLiveViews = isSessionActive || hasLiveData;
  
  // In live mode without live data, show empty state
  const showEmptyState = evidenceMode === 'live' && !hasLiveData && !isSessionActive;
  
  // Use live state when showing live views, otherwise use local state
  const effectiveOpenTabs = showLiveViews ? openTabs : localOpenTabs;
  const effectiveActiveTab = showLiveViews ? activeTab : localActiveTab;

  const handleTabClick = (tabId: TabType) => {
    if (showLiveViews) {
      setActiveTab(tabId);
    } else {
      if (!localOpenTabs.includes(tabId)) {
        setLocalOpenTabs([...localOpenTabs, tabId]);
      }
      setLocalActiveTab(tabId);
    }
  };

  const handleCloseTab = (tabId: TabType, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showLiveViews) {
      const newOpenTabs = localOpenTabs.filter(id => id !== tabId);
      setLocalOpenTabs(newOpenTabs);
      if (localActiveTab === tabId && newOpenTabs.length > 0) {
        setLocalActiveTab(newOpenTabs[newOpenTabs.length - 1]);
      }
    }
  };

  const renderTabContent = () => {
    // Use live views when session is active or has live data
    if (showLiveViews) {
      switch (effectiveActiveTab) {
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
    }
    
    // Use static views when no live data
    switch (effectiveActiveTab) {
      case 'summary':
        return <CaseSummaryView />;
      case 'timeline':
        return <TimelineView />;
      case 'damages':
        return <DamagesView />;
      case 'medical':
        return <MedicalSummaryView />;
      case 'evidence':
        return <EvidenceHubView />;
      default:
        return <EmptyCanvasState />;
    }
  };

  // Show empty state when:
  // 1. Session is active but no tabs open yet, OR
  // 2. In live mode without any live data
  if ((isSessionActive && openTabs.length === 0) || showEmptyState) {
    return (
      <div className="flex flex-col h-full bg-white">
        <EmptyCanvasState isLiveMode={evidenceMode === 'live'} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Tab Bar */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center px-2 gap-1 overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => {
            const isOpen = effectiveOpenTabs.includes(tab.id);
            const isActive = effectiveActiveTab === tab.id;
            const isUpdating = lastUpdatedTab === tab.id && isSessionActive;

            // In live mode, only show open tabs. In static mode, show all.
            if (showLiveViews && !isOpen) {
              return null;
            }

            return (
              <div
                key={tab.id}
                className={`group flex items-center gap-2 px-4 py-2 text-xs font-medium transition-all border-b-2 cursor-pointer relative ${
                  isActive
                    ? 'border-true-turquoise text-true-turquoise bg-white'
                    : isOpen
                    ? 'border-transparent text-gray-600 hover:text-true-turquoise hover:bg-gray-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => handleTabClick(tab.id)}
              >
                {/* Update indicator - subtle dot */}
                {isUpdating && !isActive && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-true-turquoise"></span>
                )}
                
                {tab.icon}
                <span className="whitespace-nowrap">{tab.label}</span>
                
                {/* Close button - only in static mode with multiple tabs */}
                {isOpen && effectiveOpenTabs.length > 1 && !showLiveViews && (
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

function EmptyCanvasState({ isLiveMode = false }: { isLiveMode?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-white">
      <div className="text-center max-w-sm px-8">
        <div className="w-12 h-12 mx-auto mb-4 border border-gray-200 rounded-lg flex items-center justify-center">
          <FileSearch className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          {isLiveMode ? 'Ready for Live Intake' : 'Ready for Intake'}
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          {isLiveMode 
            ? 'Click the microphone to start speaking with Lexie. Case details will appear here as information is gathered.'
            : 'Start a voice session to begin. Case details will populate here as information is gathered.'}
        </p>
      </div>
    </div>
  );
}
