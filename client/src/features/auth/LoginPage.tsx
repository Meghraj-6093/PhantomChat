import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AtSign, Lock, ShieldCheck } from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OAuthButtons } from "./OAuthButtons";
import type { PrivateUser } from "@/types";

const schema = z.object({
  identifier: z.string().min(1, "Enter your email or username"),
  password: z.string().min(1, "Enter your password"),
  totp: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const data = await api<{ user: PrivateUser; accessToken: string }>("/auth/login", {
        body: { ...values, totp: values.totp || undefined },
      });
      setAuth(data.user, data.accessToken);
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "TOTP_REQUIRED") {
        setNeedsTotp(true);
        setServerError("Enter your two-factor authentication code");
      } else {
        setServerError(err instanceof Error ? err.message : "Login failed");
      }
    }
  };

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold">Welcome back</h2>
      <p className="mb-6 text-sm text-muted">Sign in to continue the conversation.</p>

      <OAuthButtons />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Email or username"
          icon={<AtSign className="h-4 w-4" />}
          placeholder="you@example.com"
          autoComplete="username"
          error={errors.identifier?.message}
          {...register("identifier")}
        />
        <Input
          label="Password"
          type="password"
          icon={<Lock className="h-4 w-4" />}
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        {needsTotp && (
          <Input
            label="Two-factor code"
            icon={<ShieldCheck className="h-4 w-4" />}
            placeholder="123456"
            inputMode="numeric"
            maxLength={6}
            error={errors.totp?.message}
            {...register("totp")}
          />
        )}

        {serverError && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {serverError}
          </p>
        )}

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-primary-soft hover:text-accent-soft">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New to PhantomChat?{" "}
        <Link to="/register" className="font-medium text-primary-soft hover:text-accent-soft">
          Create an account
        </Link>
      </p>
    </div>
  );
}
