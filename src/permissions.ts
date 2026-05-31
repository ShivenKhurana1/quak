import path from 'path';

export type ToolName =
  | 'readFile'
  | 'editFile'
  | 'writeFile'
  | 'listFiles'
  | 'searchFiles'
  | 'glob'
  | 'grep'
  | 'runCommand'
  | 'searchWeb'
  | 'fetchUrl'
  | 'rememberFact'
  | 'readLints'
  | 'gitStatus'
  | 'gitDiff'
  | 'gitLog'
  | 'moveFile'
  | 'deleteFile'
  | 'restoreCheckpoint'
  | 'createPlan';

export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'plan'
  | 'dontAsk'
  | 'bypassPermissions';

export interface PermissionRule {
  pattern: string;
}

export interface PermissionSettings {
  mode: PermissionMode;
  allow: PermissionRule[];
  ask: PermissionRule[];
  deny: PermissionRule[];
}

export interface PermissionDecision {
  action: 'allow' | 'ask' | 'deny';
  reason: string;
}

const READ_SEARCH_TOOLS: ToolName[] = [
  'readFile',
  'listFiles',
  'searchFiles',
  'glob',
  'grep',
  'readLints',
  'gitStatus',
  'gitDiff',
  'gitLog',
  'fetchUrl',
];

const FILE_MUTATION_TOOLS: ToolName[] = [
  'editFile',
  'writeFile',
  'moveFile',
  'deleteFile',
  'restoreCheckpoint',
];

const PROTECTED_PATH_PREFIXES = ['.git/', '.vscode/', '.idea/', '.husky/', '.claude/'];

const PROTECTED_FILES = new Set([
  '.gitconfig',
  '.gitmodules',
  '.bashrc',
  '.bash_profile',
  '.zshrc',
  '.zprofile',
  '.profile',
  '.mcp.json',
  '.claude.json',
]);

function globToRegExp(globPattern: string): RegExp {
  let pattern = globPattern.replace(/([.+^${}()|[\]\\])/g, '\\$1');
  pattern = pattern.replace(/\*\*/g, '::DOUBLE_STAR::');
  pattern = pattern.replace(/\*/g, '[^/]*');
  pattern = pattern.replace(/\?/g, '.');
  pattern = pattern.replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${pattern}$`);
}

function normalizeRel(p: string): string {
  return p.split(path.sep).join('/').replace(/^\.\/+/, '');
}

export function isProtectedPath(relPath: string): boolean {
  const normalized = normalizeRel(relPath);
  if (PROTECTED_FILES.has(path.basename(normalized))) return true;
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix),
  );
}

function isReadSearchTool(tool: ToolName): boolean {
  return READ_SEARCH_TOOLS.includes(tool);
}

function isFileMutationTool(tool: ToolName): boolean {
  return FILE_MUTATION_TOOLS.includes(tool);
}

function matchesRule(tool: ToolName, target: string | undefined, rule: PermissionRule): boolean {
  const txt = rule.pattern.trim();
  if (!txt.includes('(')) return txt === tool;
  const m = txt.match(/^([a-zA-Z0-9_]+)\((.*)\)$/);
  if (!m) return false;
  const ruleTool = m[1] as ToolName;
  const spec = m[2];
  if (ruleTool !== tool) return false;
  if (!target) return spec === '*' || spec.length === 0;
  return globToRegExp(spec).test(normalizeRel(target));
}

function baseDecisionForMode(
  mode: PermissionMode,
  tool: ToolName,
  targetPath: string | undefined,
): PermissionDecision {
  if (mode === 'bypassPermissions') {
    return { action: 'allow', reason: 'Bypass mode' };
  }

  if (mode === 'plan') {
    if (isReadSearchTool(tool) || tool === 'createPlan') {
      return { action: 'allow', reason: 'Plan mode allows read/search/plan tools' };
    }
    return { action: 'deny', reason: 'Plan mode blocks mutating/command/network tools' };
  }

  if (mode === 'dontAsk') {
    if (isReadSearchTool(tool)) {
      return { action: 'allow', reason: 'dontAsk allows read/search' };
    }
    return { action: 'deny', reason: 'dontAsk requires explicit allow rule' };
  }

  if (mode === 'acceptEdits') {
    if (isReadSearchTool(tool) || isFileMutationTool(tool)) {
      if (targetPath && isProtectedPath(targetPath)) {
        return { action: 'ask', reason: 'Protected path' };
      }
      return { action: 'allow', reason: 'acceptEdits allows file tools' };
    }
    if (tool === 'rememberFact') return { action: 'ask', reason: 'Memory writes need confirmation' };
    if (tool === 'runCommand' || tool === 'searchWeb') {
      return { action: 'ask', reason: 'acceptEdits asks for shell/network' };
    }
    return { action: 'ask', reason: 'acceptEdits asks for unknown tool' };
  }

  if (isReadSearchTool(tool)) {
    return { action: 'allow', reason: 'default allows read/search' };
  }
  if (tool === 'rememberFact') return { action: 'ask', reason: 'Confirm memory write' };
  if (targetPath && isProtectedPath(targetPath)) {
    return { action: 'ask', reason: 'Protected path' };
  }
  return { action: 'ask', reason: 'default asks for mutating/command/network tools' };
}

export function evaluatePermission(
  settings: PermissionSettings,
  tool: ToolName,
  targetPath?: string,
): PermissionDecision {
  for (const rule of settings.deny) {
    if (matchesRule(tool, targetPath, rule)) {
      return { action: 'deny', reason: `Denied by rule: ${rule.pattern}` };
    }
  }
  for (const rule of settings.allow) {
    if (matchesRule(tool, targetPath, rule)) {
      return { action: 'allow', reason: `Allowed by rule: ${rule.pattern}` };
    }
  }
  for (const rule of settings.ask) {
    if (matchesRule(tool, targetPath, rule)) {
      return { action: 'ask', reason: `Ask by rule: ${rule.pattern}` };
    }
  }
  return baseDecisionForMode(settings.mode, tool, targetPath);
}
