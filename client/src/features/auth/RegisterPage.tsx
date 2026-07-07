import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import confetti from "canvas-confetti";
import { AtSign, Lock, Mail, User } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OAuthButtons } from "./OAuthButtons";
import type { PrivateUser } from "@/types";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(24, "At most 24 characters")
    .regex(/^[a-zA-Z0-9_.]+$/, "Letters, numbers, _ and . only"),
  displayName: z.string().min(1, "Enter a display name").max(48),
  password: z.string().min(8, "At least 8 characters"),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const data = await api<{ user: PrivateUser; accessToken: string }>("/auth/register", { body: values });
      confetti({ particleCount: 120, spread: 75, origin: { y: 0.7 }, colors: ["#6366F1", "#8B5CF6", "#22C55E"] });
      setAuth(data.user, data.accessToken);
      setTimeout(() => navigate("/", { replace: true }), 400);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold">Create your account</h2>
      <p className="mb-6 text-sm text-muted">Join the phantom realm — it takes 30 seconds.</p>

      <OAuthButtons />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          icon={<Mail className="h-4 w-4" />}
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Username"
            icon={<AtSign className="h-4 w-4" />}
            placeholder="ghost_rider"
            autoComplete="username"
            error={errors.username?.message}
            {...register("username")}
          />
          <Input
            label="Display name"
            icon={<User className="h-4 w-4" />}
            placeholder="Ghost Rider"
            error={errors.displayName?.message}
            {...register("displayName")}
          />
        </div>
        <Input
          label="Password"
          type="password"
          icon={<Lock className="h-4 w-4" />}
          placeholder="Minimum 8 characters"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />

        {serverError && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {serverError}
          </p>
        )}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary-soft hover:text-accent-soft">
          Sign in
        </Link>
      </p>
    </div>
  );
}
