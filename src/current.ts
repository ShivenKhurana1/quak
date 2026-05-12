export interface CurrentEvent {
  timestamp: number;
  type: 'xp' | 'bread' | 'pond' | 'tool' | 'levelup' | 'achievement' | 'mood' | 'system';
  message: string;
}

const MAX_EVENTS = 50;
const events: CurrentEvent[] = [];

export function pushEvent(type: CurrentEvent['type'], message: string): void {
  events.push({ timestamp: Date.now(), type, message });
  if (events.length > MAX_EVENTS) events.shift();
}

export function getRecentEvents(count: number = 5): CurrentEvent[] {
  return events.slice(-count);
}

export function formatCurrent(count: number = 5): string {
  const recent = getRecentEvents(count);
  const icons: Record<CurrentEvent['type'], string> = {
    xp: '⭐',
    bread: '',
    pond: '',
    tool: '🔧',
    levelup: '🎉',
    achievement: '🏆',
    mood: '',
    system: '💬',
  };
  return recent.map(e => {
    const time = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${icons[e.type]} ${time}  ${e.message}`;
  }).join('\n');
}