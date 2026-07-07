import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, MailCheck, ShieldCheck, Copy } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useChangePassword } from "./useSettings";
import type { PrivateUser } from "@/types";

export function SecuritySection() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  if (!user) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <EmailVerification user={user} />
      <PasswordChange />
      <TwoFactor user={user} onChanged={(u) => setUser(u)} />
    </motion.div>
  );
}

function EmailVerification({ user }: { user: PrivateUser }) {
  const [sent, setSent] = useState(false);
  if (user.emailVerified) {
    return (
      <div className="glass flex items-center gap-3 rounded-2xl p-5">
        <MailCheck className="h-5 w-5 text-success" />
        <div>
          <h3 className="text-sm font-bold">Email verified</h3>
          <p className="text-xs text-muted">{user.email}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-5">
      <MailCheck className="h-5 w-5 text-warning" />
      <div className="flex-1">
        <h3 className="text-sm font-bold">Verify your email</h3>
        <p className="text-xs text-muted">{user.email} is not verified yet.</p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={sent}
        onClick={async () => {
          await api("/auth/verify-email/request", { method: "POST" }).catch(() => {});
          setSent(true);
        }}
      >
        {sent ? "Sent ✓" : "Send link"}
      </Button>
    </div>
  );
}

function PasswordChange() {
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setMsg(null);
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
      setMsg({ ok: true, text: "Password updated ✓" });
      setCurrent("");
      setNext("");
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    }
  };

  return (
    <div className="glass space-y-4 rounded-2xl p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <KeyRound className="h-4 w-4 text-primary-soft" /> Change password
      </h3>
      <Input label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      <Input label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      {msg && <p className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
      <Button className="w-full" onClick={submit} loading={changePassword.isPending} disabled={next.length < 8}>
        Update password
      </Button>
    </div>
  );
}

function TwoFactor({ user, onChanged }: { user: PrivateUser; onChanged: (u: PrivateUser) => void }) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [secret, setSecret] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ secret: string; otpauthUrl: string }>("/auth/2fa/init", { method: "POST" });
      setSecret(data);
      setSetupOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/auth/2fa/enable", { body: { code } });
      onChanged({ ...user, twoFactorEnabled: true });
      setSetupOpen(false);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    const codePrompt = prompt("Enter your current 2FA code to disable:");
    if (!codePrompt) return;
    try {
      await api("/auth/2fa/disable", { body: { code: codePrompt } });
      onChanged({ ...user, twoFactorEnabled: false });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to disable");
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <ShieldCheck className={`h-5 w-5 ${user.twoFactorEnabled ? "text-success" : "text-muted"}`} />
        <div className="flex-1">
          <h3 className="text-sm font-bold">Two-factor authentication</h3>
          <p className="text-xs text-muted">
            {user.twoFactorEnabled ? "Enabled — TOTP required at sign-in." : "Add a TOTP app for extra security."}
          </p>
        </div>
        {user.twoFactorEnabled ? (
          <Button size="sm" variant="danger" onClick={disable}>Disable</Button>
        ) : (
          <Button size="sm" onClick={begin} loading={busy}>Enable</Button>
        )}
      </div>
      {error && !setupOpen && <p className="mt-2 text-xs text-danger">{error}</p>}

      <Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Set up two-factor auth">
        <ol className="mb-4 list-inside list-decimal space-y-1 text-sm text-muted">
          <li>Open your authenticator app (Google Authenticator, Authy, 1Password…)</li>
          <li>Add a new account using this secret key:</li>
        </ol>
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-background/50 p-3">
          <code className="flex-1 break-all font-mono text-xs text-accent-soft">{secret?.secret}</code>
          <button
            onClick={() => secret && navigator.clipboard.writeText(secret.secret)}
            className="text-muted hover:text-slate-100"
            title="Copy"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <Input
          label="Enter the 6-digit code from your app"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="123456"
        />
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        <Button className="mt-4 w-full" onClick={confirmEnable} loading={busy} disabled={code.length !== 6}>
          Verify & enable
        </Button>
      </Modal>
    </div>
  );
}
