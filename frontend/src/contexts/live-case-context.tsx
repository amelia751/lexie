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
  source?: string;       // Document name (e.g., "Incident Report", "Medical Records")
  sourceFileId?: string; // Links to the file in explorer for click-to-highlight
  addedAt: number;
}

export interface LiveMedicalRecord {
  id: string;
  date: string;
  provider: string;
  service?: string;
  amount: number;
  diagnosis?: string;
  icd10?: string;         // ICD-10 code (e.g., "S22.0", "S06.0")
  source?: string;        // Document name (e.g., "ER Records", "Doctor's Report")
  sourceFileId?: string;  // Links to the file in explorer for click-to-highlight
  addedAt: number;
}

export interface LiveDamagesEstimate {
  pastMedical?: number;
  futureMedical?: number;
  lostWages?: number;
  painAndSuffering?: number;
  propertyDamage?: number;
  economicDamages?: number;
  nonEconomicDamages?: number;
  totalEstimate?: number;
  settlementLow?: number;
  settlementHigh?: number;
  calculatedAt?: number;
}

// File uploaded by user with processing status
export interface LiveUploadedFile {
  id: string;
  name: string;
  size: string;
  type: 'medical' | 'photo' | 'insurance' | 'police' | 'deposition' | 'other';
  status: 'processing' | 'processed' | 'error';
  uploadedAt: string;
  errorMessage?: string;
  url?: string; // Object URL for viewing the file
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
  uploadedFiles: LiveUploadedFile[]; // Files in the explorer panel
  
  // Progressive update methods (autoSwitch defaults: most false, damages true)
  updateCaseFact: (field: keyof LiveCaseFacts, value: any, autoSwitch?: boolean) => void;
  addEvidenceItem: (item: Omit<LiveEvidenceItem, 'addedAt'>, autoSwitch?: boolean) => void;
  updateEvidenceStatus: (id: string, status: LiveEvidenceItem['status']) => void;
  addTimelineEvent: (event: Omit<LiveTimelineEvent, 'addedAt'>, autoSwitch?: boolean) => void;
  addMedicalRecord: (record: Omit<LiveMedicalRecord, 'addedAt'>, autoSwitch?: boolean) => void;
  updateDamages: (damages: Partial<LiveDamagesEstimate>, autoSwitch?: boolean) => void;
  
  // File upload methods
  addUploadedFile: (file: Omit<LiveUploadedFile, 'id' | 'uploadedAt'>) => string;
  updateFileStatus: (id: string, status: LiveUploadedFile['status'], errorMessage?: string) => void;
  highlightFile: (fileId: string | null) => void; // Highlight a file in the explorer
  highlightedFileId: string | null;
  
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
  const [uploadedFiles, setUploadedFiles] = useState<LiveUploadedFile[]>([]);
  const [highlightedFileId, setHighlightedFileId] = useState<string | null>(null);
  
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

  const updateCaseFact = useCallback((field: keyof LiveCaseFacts, value: any, autoSwitch: boolean = false) => {
    setCaseFacts(prev => ({ ...prev, [field]: value }));
    setLastUpdatedField(`caseFacts.${field}`);
    setLastUpdatedTab('summary');
    clearUpdateHighlight();
    
    // Always add tab to open list during session
    if (isSessionActive) {
      openTab('summary');
      // Only switch to it if autoSwitch requested
      if (autoSwitch) {
        setActiveTabState('summary');
      }
    }
  }, [clearUpdateHighlight, openTab, isSessionActive]);

  const addEvidenceItem = useCallback((item: Omit<LiveEvidenceItem, 'addedAt'>, autoSwitch: boolean = false) => {
    setEvidenceItems(prev => {
      // Check for duplicate by ID
      if (prev.some(e => e.id === item.id)) {
        return prev; // Don't add duplicates
      }
      const newItem: LiveEvidenceItem = { ...item, addedAt: Date.now() };
      return [...prev, newItem];
    });
    setLastUpdatedField(`evidence.${item.id}`);
    setLastUpdatedTab('evidence');
    clearUpdateHighlight();
    
    // Always add tab to open list during session
    if (isSessionActive) {
      openTab('evidence');
      if (autoSwitch) {
        setActiveTabState('evidence');
      }
    }
  }, [clearUpdateHighlight, openTab, isSessionActive]);

  const updateEvidenceStatus = useCallback((id: string, status: LiveEvidenceItem['status']) => {
    setEvidenceItems(prev => 
      prev.map(item => item.id === id ? { ...item, status } : item)
    );
    setLastUpdatedField(`evidence.${id}`);
    clearUpdateHighlight();
  }, [clearUpdateHighlight]);

  const addTimelineEvent = useCallback((event: Omit<LiveTimelineEvent, 'addedAt'>, autoSwitch: boolean = false) => {
    setTimelineEvents(prev => {
      // Check for duplicate - same id or same date+event combo
      const isDuplicate = prev.some(e => 
        e.id === event.id || 
        (e.date === event.date && e.event === event.event)
      );
      if (isDuplicate) {
        return prev; // Don't add duplicates
      }
      
      const newEvent: LiveTimelineEvent = { ...event, addedAt: Date.now() };
      return [...prev, newEvent].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    });
    setLastUpdatedField(`timeline.${event.id}`);
    setLastUpdatedTab('timeline');
    clearUpdateHighlight();
    
    // Always add tab to open list during session
    if (isSessionActive) {
      openTab('timeline');
      if (autoSwitch) {
        setActiveTabState('timeline');
      }
    }
  }, [clearUpdateHighlight, openTab, isSessionActive]);

  const addMedicalRecord = useCallback((record: Omit<LiveMedicalRecord, 'addedAt'>, autoSwitch: boolean = false) => {
    setMedicalRecords(prev => {
      // Check for duplicate by ID
      if (prev.some(r => r.id === record.id)) {
        return prev; // Don't add duplicates
      }
      const newRecord: LiveMedicalRecord = { ...record, addedAt: Date.now() };
      return [...prev, newRecord].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    });
    setLastUpdatedField(`medical.${record.id}`);
    setLastUpdatedTab('medical');
    clearUpdateHighlight();
    
    // Always add tab to open list during session
    if (isSessionActive) {
      openTab('medical');
      if (autoSwitch) {
        setActiveTabState('medical');
      }
    }
  }, [clearUpdateHighlight, openTab, isSessionActive]);

  const updateDamages = useCallback((damages: Partial<LiveDamagesEstimate>, autoSwitch: boolean = true) => {
    setDamagesEstimate(prev => ({ ...prev, ...damages, calculatedAt: Date.now() }));
    setLastUpdatedField('damages');
    setLastUpdatedTab('damages');
    clearUpdateHighlight();
    
    // Always add tab to open list during session
    if (isSessionActive) {
      openTab('damages');
      // Auto-switch to damages tab when damages are calculated (significant event)
      if (autoSwitch) {
        setActiveTabState('damages');
      }
    }
  }, [clearUpdateHighlight, openTab, isSessionActive]);

  const addUploadedFile = useCallback((file: Omit<LiveUploadedFile, 'id' | 'uploadedAt'>): string => {
    const id = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const uploadedAt = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    
    const newFile: LiveUploadedFile = {
      ...file,
      id,
      uploadedAt,
    };
    
    setUploadedFiles(prev => [...prev, newFile]);
    return id;
  }, []);

  const updateFileStatus = useCallback((id: string, status: LiveUploadedFile['status'], errorMessage?: string) => {
    setUploadedFiles(prev => 
      prev.map(file => 
        file.id === id 
          ? { ...file, status, errorMessage } 
          : file
      )
    );
  }, []);

  // Highlight a file in the explorer (for source tracking)
  const highlightFile = useCallback((fileId: string | null) => {
    setHighlightedFileId(fileId);
    // Auto-clear highlight after 3 seconds
    if (fileId) {
      setTimeout(() => setHighlightedFileId(null), 3000);
    }
  }, []);

  const resetCase = useCallback(() => {
    setCaseFacts(initialCaseFacts);
    setEvidenceItems([]);
    setTimelineEvents([]);
    setMedicalRecords([]);
    setDamagesEstimate(initialDamages);
    setUploadedFiles([]);
    setHighlightedFileId(null);
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
        uploadedFiles,
        updateCaseFact,
        addEvidenceItem,
        updateEvidenceStatus,
        addTimelineEvent,
        addMedicalRecord,
        updateDamages,
        addUploadedFile,
        updateFileStatus,
        highlightFile,
        highlightedFileId,
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
