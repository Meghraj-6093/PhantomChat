import { create } from "zustand";

export type EncryptionStatus =
  | "idle" // not initialised yet
  | "ready" // private key loaded, encryption usable
  | "locked" // key backup exists but this device needs a passphrase to unlock
  | "setup" // no keys anywhere yet; needs a passphrase to create them
  | "unavailable"; // Web Crypto not available (e.g. insecure context)

interface CryptoState {
  status: EncryptionStatus;
  myUserId: string | null;
  publicKey: string | null; // my base64 SPKI public key
  privateKey: CryptoKey | null;

  /** messageId → decrypted plaintext (client-only cache). */
  plaintext: Record<string, string>;
  /** messageId → true when decryption failed permanently. */
  failed: Record<string, boolean>;

  setStatus: (status: EncryptionStatus) => void;
  setKeys: (userId: string, publicKey: string, privateKey: CryptoKey) => void;
  setPlaintext: (messageId: string, text: string) => void;
  setFailed: (messageId: string) => void;
  reset: () => void;
}

export const useCryptoStore = create<CryptoState>((set) => ({
  status: "idle",
  myUserId: null,
  publicKey: null,
  privateKey: null,
  plaintext: {},
  failed: {},

  setStatus: (status) => set({ status }),
  setKeys: (myUserId, publicKey, privateKey) =>
    set({ myUserId, publicKey, privateKey, status: "ready" }),
  setPlaintext: (messageId, text) =>
    set((s) => ({ plaintext: { ...s.plaintext, [messageId]: text } })),
  setFailed: (messageId) => set((s) => ({ failed: { ...s.failed, [messageId]: true } })),
  reset: () =>
    set({ status: "idle", myUserId: null, publicKey: null, privateKey: null, plaintext: {}, failed: {} }),
}));
