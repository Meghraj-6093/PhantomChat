import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.8 12 .8 7.7.8 3.99 3.27 2.18 6.9l3.64 2.83C6.7 7.03 9.14 5.04 12 5.04z" />
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.51h6.45c-.28 1.48-1.12 2.73-2.38 3.58l3.68 2.85c2.15-1.99 3.74-4.93 3.74-8.67z" />
      <path fill="#FBBC05" d="M5.82 14.27a7.08 7.08 0 0 1 0-4.54L2.18 6.9a11.2 11.2 0 0 0 0 10.2l3.64-2.83z" />
      <path fill="#34A853" d="M12 23.2c3.02 0 5.56-1 7.41-2.72l-3.68-2.85c-1.02.69-2.32 1.1-3.73 1.1-2.86 0-5.3-1.99-6.18-4.66L2.18 17.1C3.99 20.73 7.7 23.2 12 23.2z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0C17.3 4.63 18.3 4.96 18.3 4.96c.65 1.66.24 2.88.12 3.18.77.84 1.23 1.9 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58A12 12 0 0 0 12 .3z" />
    </svg>
  );
}

export function OAuthButtons() {
  const [loading, setLoading] = useState<string | null>(null);

  const start = async (provider: "google" | "github") => {
    setLoading(provider);
    try {
      const { url } = await api<{ url: string }>(`/auth/oauth/${provider}`);
      window.location.href = url;
    } catch (err) {
      alert(err instanceof Error ? err.message : "OAuth is not configured");
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2.5">
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        loading={loading === "google"}
        onClick={() => start("google")}
      >
        <GoogleIcon /> Continue with Google
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        loading={loading === "github"}
        onClick={() => start("github")}
      >
        <GitHubIcon /> Continue with GitHub
      </Button>
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-line" />
        <span className="text-[11px] uppercase tracking-wider text-muted">or</span>
        <div className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
