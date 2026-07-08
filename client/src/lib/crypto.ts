/**
 * End-to-end encryption primitives, built entirely on the browser-native Web
 * Crypto API (no third-party crypto).
 *
 * Model:
 *  - Each user owns an ECDH P-256 identity key pair. The public key is
 *    published to the server; the private key never leaves the device in the
 *    clear.
 *  - The private key is backed up to the server wrapped with a key derived from
 *    the user's passphrase (PBKDF2 → AES-GCM), so a new device can restore it
 *    without the server ever seeing the passphrase or the raw key.
 *  - Every message gets a fresh random AES-GCM content key (CEK). The plaintext
 *    is encrypted once with the CEK; the CEK is then wrapped once per recipient
 *    using the ECDH shared secret between sender and that recipient. This one
 *    scheme covers both DMs (2 recipients) and private groups (N recipients).
 *
 * Note: this is authenticated public-key encryption, not a forward-secret
 * ratchet — compromising a long-term private key exposes past messages to that
 * user. That is a deliberate v1 scope choice.
 */

const PBKDF2_ITERATIONS = 210_000;
const dec = new TextDecoder();

// ─────────────────────────── base64 helpers ───────────────────────────
// Helpers return Uint8Array<ArrayBuffer> (not the generic ArrayBufferLike) so
// the values satisfy the Web Crypto `BufferSource` parameter types.

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function b64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function randomBytes(len: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(len)));
}

function utf8(text: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(text);
  const bytes = new Uint8Array(new ArrayBuffer(encoded.length));
  bytes.set(encoded);
  return bytes;
}

// ─────────────────────────── identity key pair ───────────────────────────

export interface IdentityKeys {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export async function generateIdentityKeys(): Promise<IdentityKeys> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  return bufToB64(await crypto.subtle.exportKey("spki", key));
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    b64ToBuf(b64),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

async function exportPrivateKeyRaw(key: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.exportKey("pkcs8", key));
}

async function importPrivateKeyRaw(bytes: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
}

// ──────────────────── passphrase-wrapped private-key backup ────────────────────

async function deriveWrappingKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", utf8(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Wrap the private key with a passphrase-derived key. Returns an opaque JSON blob. */
export async function wrapPrivateKey(privateKey: CryptoKey, passphrase: string): Promise<string> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const wrappingKey = await deriveWrappingKey(passphrase, salt);
  const raw = await exportPrivateKeyRaw(privateKey);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrappingKey, raw);
  return JSON.stringify({ v: 1, salt: bufToB64(salt), iv: bufToB64(iv), ct: bufToB64(ct) });
}

/** Reverse of wrapPrivateKey. Throws if the passphrase is wrong. */
export async function unwrapPrivateKey(blob: string, passphrase: string): Promise<CryptoKey> {
  const { salt, iv, ct } = JSON.parse(blob) as { salt: string; iv: string; ct: string };
  const wrappingKey = await deriveWrappingKey(passphrase, b64ToBuf(salt));
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBuf(iv) },
    wrappingKey,
    b64ToBuf(ct)
  );
  return importPrivateKeyRaw(new Uint8Array(raw as ArrayBuffer));
}

// ─────────────────────────── message encryption ───────────────────────────

/** AES key shared with a peer, derived from the ECDH secret (symmetric on both ends). */
async function deriveSharedKey(privateKey: CryptoKey, peerPublicKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface Recipient {
  userId: string;
  publicKey: string; // base64 SPKI
}

interface Envelope {
  v: 1;
  iv: string; // content IV
  ct: string; // ciphertext
  keys: Record<string, { k: string; iv: string }>; // userId → wrapped CEK
}

/** Marker so we can distinguish encrypted envelopes from plaintext at a glance. */
export const ENVELOPE_PREFIX = "enc:v1:";

export function isEnvelope(content: string | null | undefined): boolean {
  return typeof content === "string" && content.startsWith(ENVELOPE_PREFIX);
}

/**
 * Encrypt `plaintext` for every recipient. Returns the envelope string to store
 * as the message content. `recipients` must include the sender so they can read
 * their own message back on other devices.
 */
export async function encryptMessage(
  plaintext: string,
  myPrivateKey: CryptoKey,
  recipients: Recipient[]
): Promise<string> {
  const cek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cek, utf8(plaintext));
  const cekRaw = await crypto.subtle.exportKey("raw", cek);

  const keys: Envelope["keys"] = {};
  for (const r of recipients) {
    if (!r.publicKey) continue; // recipient hasn't set up encryption yet
    const peerPub = await importPublicKey(r.publicKey);
    const kek = await deriveSharedKey(myPrivateKey, peerPub);
    const wrapIv = randomBytes(12);
    const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv: wrapIv }, kek, cekRaw);
    keys[r.userId] = { k: bufToB64(wrapped), iv: bufToB64(wrapIv) };
  }

  const envelope: Envelope = { v: 1, iv: bufToB64(iv), ct: bufToB64(ct), keys };
  return ENVELOPE_PREFIX + JSON.stringify(envelope);
}

/**
 * Decrypt an envelope addressed to `myUserId`, sent by the holder of
 * `senderPublicKey`. Throws if we aren't a recipient or the payload is invalid.
 */
export async function decryptMessage(
  content: string,
  myPrivateKey: CryptoKey,
  myUserId: string,
  senderPublicKey: string
): Promise<string> {
  const envelope = JSON.parse(content.slice(ENVELOPE_PREFIX.length)) as Envelope;
  const entry = envelope.keys[myUserId];
  if (!entry) throw new Error("Message is not encrypted for this account");
  if (!senderPublicKey) throw new Error("Sender has no public key");

  const senderPub = await importPublicKey(senderPublicKey);
  const kek = await deriveSharedKey(myPrivateKey, senderPub);
  const cekRaw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBuf(entry.iv) },
    kek,
    b64ToBuf(entry.k)
  );
  const cek = await crypto.subtle.importKey("raw", cekRaw, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBuf(envelope.iv) },
    cek,
    b64ToBuf(envelope.ct)
  );
  return dec.decode(plain);
}

export function isCryptoAvailable(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}
