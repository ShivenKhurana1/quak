import fs from 'fs';
import path from 'path';
import os from 'os';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const KEYCHAIN_DIR = path.join(os.homedir(), '.quak');
const KEYCHAIN_FILE = path.join(KEYCHAIN_DIR, '.credentials.enc');
const SALT_FILE = path.join(KEYCHAIN_DIR, '.salt');

const ALGORITHM = 'aes-256-gcm';

function getOrCreateSalt(): Buffer {
  if (!fs.existsSync(SALT_FILE)) {
    const salt = randomBytes(32);
    fs.writeFileSync(SALT_FILE, salt.toString('hex'));
    return salt;
  }
  return Buffer.from(fs.readFileSync(SALT_FILE, 'utf-8').trim(), 'hex');
}

function deriveKey(machineId: string, salt: Buffer): Buffer {
  return scryptSync(machineId, salt, 32, { N: 2 ** 14, r: 8, p: 1 });
}

function getMachineId(): string {
  try {
    if (process.platform === 'darwin') {
      return fs.readFileSync('/var/db/.AppleSetupDone', 'utf-8').slice(0, 32);
    }
  } catch {}
  return os.hostname() + os.userInfo().username;
}

interface CredentialStore {
  providers: Array<{ name: string; apiKey: string }>;
}

function loadEncrypted(): CredentialStore {
  if (!fs.existsSync(KEYCHAIN_FILE)) return { providers: [] };
  try {
    const salt = getOrCreateSalt();
    const key = deriveKey(getMachineId(), salt);
    const data = fs.readFileSync(KEYCHAIN_FILE);
    const tag = data.subarray(data.length - 16);
    const iv = data.subarray(0, 16);
    const encrypted = data.subarray(16, data.length - 16);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf-8'));
  } catch {
    return { providers: [] };
  }
}

function saveEncrypted(store: CredentialStore): void {
  const salt = getOrCreateSalt();
  const key = deriveKey(getMachineId(), salt);
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(store), 'utf-8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  fs.writeFileSync(KEYCHAIN_FILE, Buffer.concat([iv, encrypted, tag]));
}

export function saveProviderKey(name: string, apiKey: string): void {
  const store = loadEncrypted();
  const existing = store.providers.findIndex(p => p.name === name);
  if (existing >= 0) store.providers[existing].apiKey = apiKey;
  else store.providers.push({ name, apiKey });
  saveEncrypted(store);
}

export function getProviderKey(name: string): string | null {
  const store = loadEncrypted();
  return store.providers.find(p => p.name === name)?.apiKey ?? null;
}

export function deleteProviderKey(name: string): void {
  const store = loadEncrypted();
  store.providers = store.providers.filter(p => p.name !== name);
  saveEncrypted(store);
}

export function hasEncryptedKeys(): boolean {
  return fs.existsSync(KEYCHAIN_FILE);
}