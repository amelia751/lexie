/**
 * Intake Service
 * 
 * Manages WebSocket connection to the backend intake endpoint.
 * Handles bidirectional communication and live data updates.
 */

// Types for live data from backend
export interface LiveCaseFactsFromBackend {
  plaintiffName?: string;
  plaintiffAge?: number;
  plaintiffOccupation?: string;
  employerName?: string;
  incidentDate?: string;
  incidentLocation?: string;
  incidentDescription?: string;
  incidentType?: string;
  caseType?: string;
  injuries?: string[];
  injurySeverity?: string;
  medicalExpenses?: number;
  daysMissedWork?: number;
  lostWages?: number;
  witnesses?: string[];
  safetyViolations?: string[];
  workersCompFiled?: boolean;
}

export interface LiveEvidenceItemFromBackend {
  id: string;
  type: string;
  description: string;
  status: 'required' | 'pending' | 'uploaded' | 'analyzed' | 'not_available';
  priority: 'critical' | 'important' | 'helpful';
}

export interface LiveTimelineEventFromBackend {
  id: string;
  date: string;
  event: string;
  description?: string;
  category: string;
}

export interface LiveMedicalRecordFromBackend {
  id: string;
  date: string;
  provider: string;
  service: string;
  amount: number;
  diagnosis?: string;
}

export interface LiveDamagesEstimateFromBackend {
  pastMedical?: number;
  futureMedical?: number;
  lostWages?: number;
  settlementLow?: number;
  settlementHigh?: number;
}

export interface ChecklistStatus {
  total: number;
  required: number;
  pending: number;
  uploaded: number;
  analyzed: number;
  not_available: number;
}

export interface LiveDataSnapshot {
  caseFacts: LiveCaseFactsFromBackend;
  evidenceItems: LiveEvidenceItemFromBackend[];
  timelineEvents: LiveTimelineEventFromBackend[];
  medicalRecords: LiveMedicalRecordFromBackend[];
  damagesEstimate: LiveDamagesEstimateFromBackend;
  checklistStatus: ChecklistStatus;
}

// Message types from server
interface ServerMessage {
  type: 'status' | 'response' | 'live_update' | 'tool_call' | 'error' | 'session_end';
  content?: string;
  message?: string;
  data?: LiveDataSnapshot;
  tool?: string;
  args?: Record<string, unknown>;
}

type MessageHandler = (message: ServerMessage) => void;
type LiveUpdateHandler = (data: LiveDataSnapshot) => void;
type ResponseHandler = (response: string) => void;
type ErrorHandler = (error: string) => void;
type StatusHandler = (status: string, message?: string) => void;
type ToolCallHandler = (tool: string, args: Record<string, unknown>) => void;

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const WS_URL = BACKEND_URL.replace('http', 'ws');

export class IntakeService {
  private ws: WebSocket | null = null;
  private clientId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private messageHandlers: Set<MessageHandler> = new Set();
  private liveUpdateHandlers: Set<LiveUpdateHandler> = new Set();
  private responseHandlers: Set<ResponseHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private toolCallHandlers: Set<ToolCallHandler> = new Set();
  
  constructor() {
    this.clientId = this.generateClientId();
  }
  
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  // Event handlers
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }
  
  onLiveUpdate(handler: LiveUpdateHandler): () => void {
    this.liveUpdateHandlers.add(handler);
    return () => this.liveUpdateHandlers.delete(handler);
  }
  
  onResponse(handler: ResponseHandler): () => void {
    this.responseHandlers.add(handler);
    return () => this.responseHandlers.delete(handler);
  }
  
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }
  
  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }
  
  onToolCall(handler: ToolCallHandler): () => void {
    this.toolCallHandlers.add(handler);
    return () => this.toolCallHandlers.delete(handler);
  }
  
  // Connect to WebSocket
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      
      try {
        this.ws = new WebSocket(`${WS_URL}/api/v1/intake/${this.clientId}`);
        
        this.ws.onopen = () => {
          console.log('[IntakeService] Connected to backend');
          this.reconnectAttempts = 0;
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message: ServerMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.error('[IntakeService] Failed to parse message:', e);
          }
        };
        
        this.ws.onclose = (event) => {
          console.log('[IntakeService] Connection closed:', event.code, event.reason);
          this.ws = null;
          
          // Auto-reconnect if not intentionally closed
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[IntakeService] Reconnecting... attempt ${this.reconnectAttempts}`);
            setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('[IntakeService] WebSocket error:', error);
          reject(error);
        };
      } catch (e) {
        reject(e);
      }
    });
  }
  
  // Handle incoming message
  private handleMessage(message: ServerMessage) {
    // Notify all message handlers
    this.messageHandlers.forEach(handler => handler(message));
    
    switch (message.type) {
      case 'status':
        this.statusHandlers.forEach(handler => handler(message.content || '', message.message));
        break;
      case 'response':
        if (message.content) {
          this.responseHandlers.forEach(handler => handler(message.content!));
        }
        break;
      case 'live_update':
        if (message.data) {
          this.liveUpdateHandlers.forEach(handler => handler(message.data!));
        }
        break;
      case 'tool_call':
        if (message.tool) {
          this.toolCallHandlers.forEach(handler => handler(message.tool!, message.args || {}));
        }
        break;
      case 'error':
        this.errorHandlers.forEach(handler => handler(message.content || 'Unknown error'));
        break;
      case 'session_end':
        this.statusHandlers.forEach(handler => handler('session_end', 'Session ended'));
        break;
    }
  }
  
  // Send a message to the agent
  async sendMessage(content: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
    
    this.ws!.send(JSON.stringify({
      type: 'message',
      content,
    }));
  }
  
  // Reset the conversation
  async reset(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
    
    this.ws!.send(JSON.stringify({
      type: 'reset',
    }));
  }
  
  // End the session
  async end(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'end',
      }));
    }
  }
  
  // Disconnect
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }
  
  // Check if connected
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
  
  // HTTP-based fallback for single messages
  async sendMessageHttp(message: string, sessionId?: string): Promise<{
    response: string;
    sessionId: string;
    liveData: LiveDataSnapshot;
  }> {
    const response = await fetch(`${BACKEND_URL}/api/v1/intake/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Request failed');
    }
    
    const data = await response.json();
    return {
      response: data.response,
      sessionId: data.session_id,
      liveData: data.live_data,
    };
  }
  
  // Get current state via HTTP
  async getState(): Promise<LiveDataSnapshot> {
    const response = await fetch(`${BACKEND_URL}/api/v1/intake/state`);
    if (!response.ok) {
      throw new Error('Failed to get state');
    }
    return response.json();
  }
  
  // Reset state via HTTP
  async resetHttp(): Promise<LiveDataSnapshot> {
    const response = await fetch(`${BACKEND_URL}/api/v1/intake/reset`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to reset');
    }
    const data = await response.json();
    return data.live_data;
  }
}

// Singleton instance
export const intakeService = new IntakeService();
