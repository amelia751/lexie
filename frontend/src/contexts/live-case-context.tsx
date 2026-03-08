'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useRef, useMemo } from 'react';

// Types for progressive case data
export interface LiveCaseFacts {
  plaintiffName?: string;
  plaintiffAge?: number;
  plaintiffOccupation?: string;
  employerName?: string;
  incidentDate?: string;
  incidentLocation?: string;
  incidentDescription?: string;
  incidentType?: string;
  caseType?: string;
  jurisdiction?: string;
  liability?: string;
  injuries?: string[];
  injurySeverity?: string;
  medicalExpenses?: number;
  daysMissedWork?: number;
  lostWages?: number;
  witnesses?: string[];
  safetyViolations?: string[];
  workersCompFiled?: boolean;
}

export interface LiveEvidenceItem {
  id: string;
  type: string;
  description: string;
  status: 'required' | 'uploaded' | 'pending' | 'not_available';
  priority: 'critical' | 'important' | 'helpful';
  addedAt: number;
}

export interface LiveTimelineEvent {
  id: string;
  date: string;
  time?: string;
  event: string;
  description?: string;
  category: 'incident' | 'medical' | 'legal' | 'insurance';
  addedAt: number;
}

export interface LiveMedicalRecord {
  id: string;
  date: string;
  provider: string;
  service: string;
  amount: number;
  diagnosis?: string;
  addedAt: number;
}

export interface LiveDamagesEstimate {
  pastMedical?: number;
  futureMedical?: number;
  lostWages?: number;
  painAndSuffering?: number;
  propertyDamage?: number;
  settlementLow?: number;
  settlementHigh?: number;
  calculatedAt?: number;
}

export type TabType = 'summary' | 'timeline' | 'damages' | 'medical' | 'evidence';

interface LiveCaseContextType {
  // Session state
  isSessionActive: boolean;
  hasLiveData: boolean; // True if there's any live data to show
  startSession: () => void;
  endSession: () => void;
  
  // Tab control
  activeTab: TabType;
  openTabs: TabType[];
  setActiveTab: (tab: TabType) => void;
  openTab: (tab: TabType) => void;
  
  // Case data
  caseFacts: LiveCaseFacts;
  evidenceItems: LiveEvidenceItem[];
  timelineEvents: LiveTimelineEvent[];
  medicalRecords: LiveMedicalRecord[];
  damagesEstimate: LiveDamagesEstimate;
  
  // Progressive update methods
  updateCaseFact: (field: keyof LiveCaseFacts, value: any) => void;
  addEvidenceItem: (item: Omit<LiveEvidenceItem, 'addedAt'>) => void;
  updateEvidenceStatus: (id: string, status: LiveEvidenceItem['status']) => void;
  addTimelineEvent: (event: Omit<LiveTimelineEvent, 'addedAt'>) => void;
  addMedicalRecord: (record: Omit<LiveMedicalRecord, 'addedAt'>) => void;
  updateDamages: (damages: Partial<LiveDamagesEstimate>) => void;
  
  // Animation tracking
  lastUpdatedField: string | null;
  lastUpdatedTab: TabType | null;
  isTyping: boolean;
  currentlyTypingField: string | null;
  
  // Reset
  resetCase: () => void;
}

const LiveCaseContext = createContext<LiveCaseContextType | undefined>(undefined);

const initialCaseFacts: LiveCaseFacts = {};
const initialDamages: LiveDamagesEstimate = {};

export function LiveCaseProvider({ children }: { children: ReactNode }) {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [activeTab, setActiveTabState] = useState<TabType>('summary');
  const [openTabs, setOpenTabs] = useState<TabType[]>([]);
  
  const [caseFacts, setCaseFacts] = useState<LiveCaseFacts>(initialCaseFacts);
  const [evidenceItems, setEvidenceItems] = useState<LiveEvidenceItem[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<LiveTimelineEvent[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<LiveMedicalRecord[]>([]);
  const [damagesEstimate, setDamagesEstimate] = useState<LiveDamagesEstimate>(initialDamages);
  
  const [lastUpdatedField, setLastUpdatedField] = useState<string | null>(null);
  const [lastUpdatedTab, setLastUpdatedTab] = useState<TabType | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [currentlyTypingField, setCurrentlyTypingField] = useState<string | null>(null);
  
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if there's any live data to display
  const hasLiveData = useMemo(() => {
    return (
      Object.keys(caseFacts).length > 0 ||
      evidenceItems.length > 0 ||
      timelineEvents.length > 0 ||
      medicalRecords.length > 0 ||
      damagesEstimate.calculatedAt !== undefined
    );
  }, [caseFacts, evidenceItems, timelineEvents, medicalRecords, damagesEstimate]);

  const startSession = useCallback(() => {
    setIsSessionActive(true);
    setOpenTabs(['summary']);
    setActiveTabState('summary');
  }, []);

  const endSession = useCallback(() => {
    setIsSessionActive(false);
    // Don't reset data - keep it visible after session ends
  }, []);

  const openTab = useCallback((tab: TabType) => {
    setOpenTabs(prev => {
      if (!prev.includes(tab)) {
        return [...prev, tab];
      }
      return prev;
    });
  }, []);

  const setActiveTab = useCallback((tab: TabType) => {
    openTab(tab);
    setActiveTabState(tab);
    setLastUpdatedTab(tab);
  }, [openTab]);

  const clearUpdateHighlight = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(() => {
      setLastUpdatedField(null);
    }, 2000);
  }, []);

  const updateCaseFact = useCallback((field: keyof LiveCaseFacts, value: any) => {
    setCaseFacts(prev => ({ ...prev, [field]: value }));
    setLastUpdatedField(`caseFacts.${field}`);
    setLastUpdatedTab('summary');
    clearUpdateHighlight();
    
    // Only auto-switch tabs during active session
    if (isSessionActive) {
      setActiveTab('summary');
    }
  }, [clearUpdateHighlight, setActiveTab, isSessionActive]);

  const addEvidenceItem = useCallback((item: Omit<LiveEvidenceItem, 'addedAt'>) => {
    const newItem: LiveEvidenceItem = { ...item, addedAt: Date.now() };
    setEvidenceItems(prev => [...prev, newItem]);
    setLastUpdatedField(`evidence.${item.id}`);
    setLastUpdatedTab('evidence');
    clearUpdateHighlight();
    
    // Only auto-switch tabs during active session
    if (isSessionActive) {
      setActiveTab('evidence');
    }
  }, [clearUpdateHighlight, setActiveTab, isSessionActive]);

  const updateEvidenceStatus = useCallback((id: string, status: LiveEvidenceItem['status']) => {
    setEvidenceItems(prev => 
      prev.map(item => item.id === id ? { ...item, status } : item)
    );
    setLastUpdatedField(`evidence.${id}`);
    clearUpdateHighlight();
  }, [clearUpdateHighlight]);

  const addTimelineEvent = useCallback((event: Omit<LiveTimelineEvent, 'addedAt'>) => {
    const newEvent: LiveTimelineEvent = { ...event, addedAt: Date.now() };
    setTimelineEvents(prev => [...prev, newEvent].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    ));
    setLastUpdatedField(`timeline.${event.id}`);
    setLastUpdatedTab('timeline');
    clearUpdateHighlight();
    
    // Only auto-switch tabs during active session
    if (isSessionActive) {
      setActiveTab('timeline');
    }
  }, [clearUpdateHighlight, setActiveTab, isSessionActive]);

  const addMedicalRecord = useCallback((record: Omit<LiveMedicalRecord, 'addedAt'>) => {
    const newRecord: LiveMedicalRecord = { ...record, addedAt: Date.now() };
    setMedicalRecords(prev => [...prev, newRecord].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    ));
    setLastUpdatedField(`medical.${record.id}`);
    setLastUpdatedTab('medical');
    clearUpdateHighlight();
    
    // Only auto-switch tabs during active session
    if (isSessionActive) {
      setActiveTab('medical');
    }
  }, [clearUpdateHighlight, setActiveTab, isSessionActive]);

  const updateDamages = useCallback((damages: Partial<LiveDamagesEstimate>) => {
    setDamagesEstimate(prev => ({ ...prev, ...damages, calculatedAt: Date.now() }));
    setLastUpdatedField('damages');
    setLastUpdatedTab('damages');
    clearUpdateHighlight();
    
    // Only auto-switch tabs during active session
    if (isSessionActive) {
      setActiveTab('damages');
    }
  }, [clearUpdateHighlight, setActiveTab, isSessionActive]);

  const resetCase = useCallback(() => {
    setCaseFacts(initialCaseFacts);
    setEvidenceItems([]);
    setTimelineEvents([]);
    setMedicalRecords([]);
    setDamagesEstimate(initialDamages);
    setOpenTabs([]);
    setActiveTabState('summary');
    setLastUpdatedField(null);
    setLastUpdatedTab(null);
    setIsTyping(false);
    setCurrentlyTypingField(null);
  }, []);

  return (
    <LiveCaseContext.Provider
      value={{
        isSessionActive,
        hasLiveData,
        startSession,
        endSession,
        activeTab,
        openTabs,
        setActiveTab,
        openTab,
        caseFacts,
        evidenceItems,
        timelineEvents,
        medicalRecords,
        damagesEstimate,
        updateCaseFact,
        addEvidenceItem,
        updateEvidenceStatus,
        addTimelineEvent,
        addMedicalRecord,
        updateDamages,
        lastUpdatedField,
        lastUpdatedTab,
        isTyping,
        currentlyTypingField,
        resetCase,
      }}
    >
      {children}
    </LiveCaseContext.Provider>
  );
}

export function useLiveCase() {
  const context = useContext(LiveCaseContext);
  if (context === undefined) {
    throw new Error('useLiveCase must be used within a LiveCaseProvider');
  }
  return context;
}
