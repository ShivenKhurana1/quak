import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';

const SCREENSHOTS_DIR = path.join(os.homedir(), '.quak', 'screenshots');

export function ensureScreenshotsDir(): void {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

export function takeScreenshot(display?: number): string {
  ensureScreenshotsDir();
  const filename = `screenshot-${Date.now()}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  const platform = process.platform;
  if (platform === 'darwin') {
    execSync(`screencapture -x ${display != null ? `-D ${display}` : ''} "${filepath}"`);
  } else if (platform === 'linux') {
    execSync(`import -window root "${filepath}"`);
  } else {
    throw new Error('Screenshots not supported on this platform');
  }
  return filepath;
}

export function imageToDataUrl(filepath: string): string {
  const ext = path.extname(filepath).toLowerCase().replace('.', '');
  const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/webp';
  const data = fs.readFileSync(filepath).toString('base64');
  return `data:${mime};base64,${data}`;
}

export const screenshotTool = {
  description: 'Capture a screenshot of the screen or a specific display',
  inputSchema: z.object({
    display: z.number().optional(),
    reasoning: z.string(),
  }),
  execute: async ({ display }: { display?: number }): Promise<string> => {
    try {
      const filepath = takeScreenshot(display);
      const dataUrl = imageToDataUrl(filepath);
      return `Screenshot saved: ${filepath}\n\nImage data: ${dataUrl.slice(0, 500)}...[truncated]\n\nPass the data URL to the model as a user image message for analysis.`;
    } catch (e) {
      return `Screenshot failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};