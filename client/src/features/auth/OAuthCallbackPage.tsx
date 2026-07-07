import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { SplashScreen } from "@/components/system/SplashScreen";
import type { PrivateUser } from "@/types";

export default function OAuthCallbackPage() {
  const { provider } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state || !provider) {
      setError("Missing OAuth parameters");
      return;
    }
    api<{ user: PrivateUser; accessToken: string }>(`/auth/oauth/${provider}/callback`, {
      body: { code, state },
    })
      .then((data) => {
        setAuth(data.user, data.accessToken);
        navigate("/", { replace: true });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "OAuth sign-in failed"));
  }, [navigate, params, provider, setAuth]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-lg font-semibold text-danger">Sign-in failed</p>
        <p className="text-sm text-muted">{error}</p>
        <button
          onClick={() => navigate("/login")}
          className="rounded-xl bg-gradient-brand px-6 py-2.5 text-sm font-medium text-white"
        >
          Back to login
        </button>
      </div>
    );
  }
  return <SplashScreen />;
}
