export interface PlanStep {
  id: number;
  description: string;
  tools?: string[];
  dependencies?: number[];
  estimatedDuration?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
}

export interface Plan {
  title: string;
  steps: PlanStep[];
  snapshotId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  messages: Array<{ role: string; content: string }>;
  plan?: Plan;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

const sessions = new Map<string, Session>();

export function getOrCreateSession(sessionId: string): Session {
  let session = sessions.get(sessionId);
  
  if (!session) {
    session = {
      id: sessionId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    sessions.set(sessionId, session);
  }

  return session;
}

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

export function addMessage(sessionId: string, role: string, content: string): void {
  const session = getOrCreateSession(sessionId);
  session.messages.push({ role, content });
  session.updatedAt = Date.now();
}

export function setPlan(sessionId: string, plan: Plan): void {
  const session = getOrCreateSession(sessionId);
  session.plan = plan;
  session.updatedAt = Date.now();
}

export function updateStepStatus(sessionId: string, stepId: number, status: PlanStep['status'], result?: string): void {
  const session = getSession(sessionId);
  if (!session?.plan) return;

  const step = session.plan.steps.find(s => s.id === stepId);
  if (step) {
    step.status = status;
    step.result = result;
    session.plan.updatedAt = Date.now();
    session.updatedAt = Date.now();
  }
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function createSessionId(): string {
  return `quak-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}