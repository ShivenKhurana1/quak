import { spawn, ChildProcess } from 'child_process';
import path from 'path';

interface LspPosition {
  line: number;
  character: number;
}

interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

interface LspLocation {
  uri: string;
  range: LspRange;
}

interface LspCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
}

export class LspClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private buffer = '';
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private capabilities: Record<string, any> = {};
  private initialized = false;

  constructor(private serverCommand: string, private serverArgs: string[], private rootUri: string) {}

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.serverCommand, this.serverArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.buffer += data.toString();
        this.processMessages();
      });

      this.process.stderr?.on('data', () => {}); // suppress

      this.process.on('error', reject);

      this.initialize().then(resolve).catch(reject);
    });
  }

  private processMessages(): void {
    const parts = this.buffer.split('\r\n');
    while (parts.length >= 2) {
      const header = parts[0];
      const contentLengthMatch = header.match(/Content-Length: (\d+)/i);
      if (!contentLengthMatch) break;
      const contentLength = parseInt(contentLengthMatch[1], 10);
      const content = parts[1];
      if (content.length < contentLength) break;
      const jsonStr = content.slice(0, contentLength);
      try {
        const msg = JSON.parse(jsonStr);
        this.handleMessage(msg);
      } catch {}
      this.buffer = parts.slice(2).join('\r\n');
    }
  }

  private handleMessage(msg: any): void {
    if (msg.id != null && this.pending.has(msg.id)) {
      const { resolve } = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      resolve(msg.result);
    }
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      const header = `Content-Length: ${Buffer.byteLength(msg, 'utf-8')}\r\n\r\n`;
      this.process?.stdin?.write(header + msg);
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('LSP request timed out'));
        }
      }, 10000);
    });
  }

  private async initialize(): Promise<void> {
    const result = await this.sendRequest('initialize', {
      processId: process.pid,
      rootUri: `file://${this.rootUri}`,
      capabilities: {
        textDocument: {
          completion: { dynamicRegistration: true },
          definition: { dynamicRegistration: true },
          references: { dynamicRegistration: true },
          hover: { dynamicRegistration: true },
        },
      },
    });
    this.capabilities = result.capabilities ?? {};
    await this.sendRequest('initialized', {});
    this.initialized = true;
  }

  async openDocument(filePath: string): Promise<void> {
    await this.sendRequest('textDocument/didOpen', {
      textDocument: {
        uri: `file://${filePath}`,
        languageId: this.guessLanguage(filePath),
        version: 1,
        text: '',
      },
    });
  }

  async findReferences(filePath: string, line: number, character: number): Promise<LspLocation[]> {
    const result = await this.sendRequest('textDocument/references', {
      textDocument: { uri: `file://${filePath}` },
      position: { line, character },
      context: { includeDeclaration: true },
    });
    return result ?? [];
  }

  async goToDefinition(filePath: string, line: number, character: number): Promise<LspLocation | null> {
    const result = await this.sendRequest('textDocument/definition', {
      textDocument: { uri: `file://${filePath}` },
      position: { line, character },
    });
    if (Array.isArray(result)) return result[0] ?? null;
    return result ?? null;
  }

  async getCompletions(filePath: string, line: number, character: number): Promise<LspCompletionItem[]> {
    const result = await this.sendRequest('textDocument/completion', {
      textDocument: { uri: `file://${filePath}` },
      position: { line, character },
    });
    if (result?.items) return result.items;
    if (Array.isArray(result)) return result;
    return [];
  }

  async getHover(filePath: string, line: number, character: number): Promise<string | null> {
    const result = await this.sendRequest('textDocument/hover', {
      textDocument: { uri: `file://${filePath}` },
      position: { line, character },
    });
    if (!result) return null;
    if (typeof result.contents === 'string') return result.contents;
    if (Array.isArray(result.contents)) return result.contents.map((c: any) => typeof c === 'string' ? c : c.value ?? '').join('\n');
    if (result.contents?.value) return result.contents.value;
    return JSON.stringify(result.contents);
  }

  async getSymbols(filePath: string): Promise<{ name: string; kind: string; range: LspRange }[]> {
    const result = await this.sendRequest('textDocument/documentSymbol', {
      textDocument: { uri: `file://${filePath}` },
    });
    if (!result) return [];
    return result.map((s: any) => ({
      name: s.name ?? s.childName ?? 'unknown',
      kind: this.symbolKindName(s.kind),
      range: s.range ?? s.location?.range ?? { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    }));
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    await this.sendRequest('shutdown', null);
    this.process?.stdin?.end();
    this.process?.kill();
    this.initialized = false;
  }

  private guessLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      '.ts': 'typescript', '.tsx': 'typescriptreact', '.js': 'javascript',
      '.jsx': 'javascriptreact', '.py': 'python', '.rs': 'rust',
      '.go': 'go', '.java': 'java', '.rb': 'ruby', '.php': 'php',
    };
    return map[ext] ?? 'plaintext';
  }

  private symbolKindName(kind: number): string {
    const names: Record<number, string> = {
      1: 'File', 2: 'Module', 3: 'Namespace', 4: 'Package', 5: 'Class',
      6: 'Method', 7: 'Property', 8: 'Field', 9: 'Constructor',
      10: 'Enum', 11: 'Interface', 12: 'Function', 13: 'Variable',
      14: 'Constant', 15: 'String', 16: 'Number', 17: 'Boolean',
      18: 'Array', 19: 'Object', 20: 'Key', 21: 'Null',
      22: 'EnumMember', 23: 'Struct', 24: 'Event', 25: 'Operator',
      26: 'TypeParameter',
    };
    return names[kind] ?? 'Unknown';
  }
}