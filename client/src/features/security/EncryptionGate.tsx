import { useState } from "react";
import { ShieldCheck, Lock, KeyRound } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useCryptoStore } from "@/stores/cryptoStore";
import { unlockEncryption } from "@/lib/encryption";

/**
 * Prompts for the encryption passphrase when this device can't load the private
 * key on its own — i.e. a new device / cleared browser ("locked", restore) or an
 * account that never set up keys, such as an OAuth sign-in ("setup", create).
 * Password-based logins pass their password automatically, so this rarely shows.
 */
export function EncryptionGate() {
  const status = useCryptoStore((s) => s.status);
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = status === "locked" || status === "setup";
  const isSetup = status === "setup";

  const submit = async () => {
    setError(null);
    if (passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters.");
      return;
    }
    if (isSetup && passphrase !== confirm) {
      setError("Passphrases don't match.");
      return;
    }
    setBusy(true);
    try {
      await unlockEncryption(passphrase);
      setPassphrase("");
      setConfirm("");
    } catch {
      setError(
        isSetup
          ? "Couldn't set up encryption. Please try again."
          : "That passphrase didn't unlock your messages. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => {}} className="max-w-sm">
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary-soft">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold">
          {isSetup ? "Set up secure messaging" : "Unlock your messages"}
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          {isSetup
            ? "Choose a passphrase to protect your end-to-end encrypted messages. You'll need it to read your history on other devices — it can't be recovered if you forget it."
            : "Enter your encryption passphrase to decrypt your messages on this device."}
        </p>

        <div className="w-full space-y-3 text-left">
          <Input
            label={isSetup ? "New passphrase" : "Passphrase"}
            type="password"
            icon={<Lock className="h-4 w-4" />}
            placeholder="••••••••"
            autoComplete={isSetup ? "new-password" : "current-password"}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isSetup && submit()}
          />
          {isSetup && (
            <Input
              label="Confirm passphrase"
              type="password"
              icon={<KeyRound className="h-4 w-4" />}
              placeholder="••••••••"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          )}

          {error && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <Button className="w-full" onClick={submit} loading={busy}>
            {isSetup ? "Enable encryption" : "Unlock"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
