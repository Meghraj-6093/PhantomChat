/**
 * Key lifecycle + high-level encrypt/decrypt helpers that sit on top of the raw
 * primitives in `crypto.ts`. Manages: loading the private key from IndexedDB,
 * generating it on first use, restoring it from the passphrase-wrapped server
 * backup on a new device, and caching decrypted plaintext.
 */
import {
  decryptMessage,
  encryptMessage,
  exportPublicKey,
  generateIdentityKeys,
  isCryptoAvailable,
  unwrapPrivateKey,
  wrapPrivateKey,
  type Recipient,
} from "./crypto";
import { api } from "./api";
import { useAuthStore } from "@/stores/authStore";
import { useCryptoStore } from "@/stores/cryptoStore";
import type { Chat, Message, PrivateUser } from "@/types";

// ─────────────────────────── IndexedDB (private key) ───────────────────────────

const DB_NAME = "phantom-e2ee";
const STORE = "keys";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

interface StoredKey {
  privateKey: CryptoKey;
  publicKey: string;
}

async function idbGet(userId: string): Promise<StoredKey | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly").objectStore(STORE).get(userId);
    tx.onsuccess = () => resolve(tx.result as StoredKey | undefined);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbSet(userId: string, value: StoredKey): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, userId);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(userId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite").objectStore(STORE).delete(userId);
      tx.onsuccess = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

// ─────────────────────────── lifecycle ───────────────────────────

/**
 * Ensure the current user's encryption keys are loaded. With a passphrase this
 * will generate keys (first ever) or restore them from the server backup (new
 * device). Without one it loads from IndexedDB, or flags that a passphrase is
 * needed ("locked" = restore, "setup" = create).
 */
export async function initEncryption(user: PrivateUser, passphrase?: string): Promise<void> {
  const store = useCryptoStore.getState();
  if (!isCryptoAvailable()) {
    store.setStatus("unavailable");
    return;
  }
  if (store.status === "ready" && store.myUserId === user.id) return;

  const existing = await idbGet(user.id).catch(() => undefined);
  if (existing) {
    store.setKeys(user.id, existing.publicKey, existing.privateKey);
    return;
  }

  if (!passphrase) {
    store.setStatus(user.hasKeyBackup ? "locked" : "setup");
    return;
  }
  await setupWithPassphrase(user, passphrase);
}

async function setupWithPassphrase(user: PrivateUser, passphrase: string): Promise<void> {
  const store = useCryptoStore.getState();

  if (user.hasKeyBackup) {
    // Restore from server backup — throws on a wrong passphrase.
    const backup = await api<{ publicKey: string | null; encryptedPrivateKey: string | null }>(
      "/users/me/keys"
    );
    if (!backup.encryptedPrivateKey || !backup.publicKey) {
      // Server says a backup exists but it's incomplete; fall through to create.
      return createKeys(user, passphrase);
    }
    const privateKey = await unwrapPrivateKey(backup.encryptedPrivateKey, passphrase);
    await idbSet(user.id, { privateKey, publicKey: backup.publicKey });
    store.setKeys(user.id, backup.publicKey, privateKey);
    return;
  }

  await createKeys(user, passphrase);
}

async function createKeys(user: PrivateUser, passphrase: string): Promise<void> {
  const store = useCryptoStore.getState();
  const keys = await generateIdentityKeys();
  const publicKey = await exportPublicKey(keys.publicKey);
  const encryptedPrivateKey = await wrapPrivateKey(keys.privateKey, passphrase);
  await api("/users/me/keys", { method: "PUT", body: { publicKey, encryptedPrivateKey } });
  await idbSet(user.id, { privateKey: keys.privateKey, publicKey });
  store.setKeys(user.id, publicKey, keys.privateKey);

  // Reflect the new key in the cached auth user.
  const authUser = useAuthStore.getState().user;
  if (authUser && authUser.id === user.id) {
    useAuthStore.getState().setUser({ ...authUser, publicKey, hasKeyBackup: true });
  }
}

/** Called by the unlock modal. Uses the passphrase to restore or create keys. */
export async function unlockEncryption(passphrase: string): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Not signed in");
  await setupWithPassphrase(user, passphrase);
}

/**
 * Reset the in-memory crypto state on logout. The private key is intentionally
 * left in IndexedDB so re-logging in on the same device is seamless (no
 * passphrase prompt); use `forgetDevice` to wipe it entirely.
 */
export function resetEncryptionState(): void {
  useCryptoStore.getState().reset();
}

/** Erase this device's stored private key (e.g. a "sign out everywhere" action). */
export async function forgetDevice(): Promise<void> {
  const userId = useCryptoStore.getState().myUserId;
  if (userId) await idbDelete(userId);
  useCryptoStore.getState().reset();
}

// ─────────────────────────── encrypt / decrypt ───────────────────────────

/** DMs and private (non-public) groups are eligible for E2EE. */
export function chatIsEncryptable(chat: Pick<Chat, "type" | "isPublic">): boolean {
  return (chat.type === "DM" || chat.type === "GROUP") && !chat.isPublic;
}

/**
 * Encrypt plaintext for a chat if possible. Returns the ciphertext envelope and
 * `isEncrypted: true`, or falls back to plaintext when the chat isn't
 * encryptable, our keys aren't ready, or no peer has published a key yet
 * (encrypting only to ourselves would make the message unreadable to them).
 */
export async function encryptForChat(
  chat: Chat,
  plaintext: string
): Promise<{ content: string; isEncrypted: boolean }> {
  const store = useCryptoStore.getState();
  if (!chatIsEncryptable(chat) || store.status !== "ready" || !store.privateKey || !store.myUserId) {
    return { content: plaintext, isEncrypted: false };
  }

  const recipients: Recipient[] = [];
  let peerWithKey = false;
  for (const m of chat.members) {
    if (!m.user.publicKey) continue;
    recipients.push({ userId: m.userId, publicKey: m.user.publicKey });
    if (m.userId !== store.myUserId) peerWithKey = true;
  }
  if (!peerWithKey) return { content: plaintext, isEncrypted: false };

  const content = await encryptMessage(plaintext, store.privateKey, recipients);
  return { content, isEncrypted: true };
}

/**
 * Decrypt an incoming encrypted message into the plaintext cache. No-op if
 * already decrypted, already failed, or keys aren't ready yet (it will be
 * retried once they are).
 */
export async function decryptInto(message: Message): Promise<void> {
  if (!message.isEncrypted || !message.content) return;
  const store = useCryptoStore.getState();
  if (store.plaintext[message.id] !== undefined || store.failed[message.id]) return;
  if (store.status !== "ready" || !store.privateKey || !store.myUserId) return;

  try {
    const text = await decryptMessage(
      message.content,
      store.privateKey,
      store.myUserId,
      message.sender?.publicKey ?? ""
    );
    store.setPlaintext(message.id, text);
  } catch {
    store.setFailed(message.id);
  }
}

/** Remember plaintext we already have (our own outgoing message) to skip a decrypt. */
export function cachePlaintext(messageId: string, text: string): void {
  useCryptoStore.getState().setPlaintext(messageId, text);
}

/**
 * Re-wrap the private-key backup with a new passphrase (call after the account
 * password changes) so it can still be restored on a new device. No-op if keys
 * aren't loaded on this device.
 */
export async function rewrapBackup(newPassphrase: string): Promise<void> {
  const store = useCryptoStore.getState();
  if (store.status !== "ready" || !store.privateKey || !store.publicKey) return;
  const encryptedPrivateKey = await wrapPrivateKey(store.privateKey, newPassphrase);
  await api("/users/me/keys", {
    method: "PUT",
    body: { publicKey: store.publicKey, encryptedPrivateKey },
  });
}
