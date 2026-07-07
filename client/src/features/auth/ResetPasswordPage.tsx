import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });
type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await api("/auth/reset-password", { body: { token, password: values.password } });
      navigate("/login", { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Reset failed");
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="mb-2 text-xl font-bold">Invalid link</h2>
        <p className="text-sm text-muted">This reset link is missing its token.</p>
        <Link to="/forgot-password" className="mt-4 inline-block text-sm font-medium text-primary-soft">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold">Choose a new password</h2>
      <p className="mb-6 text-sm text-muted">Your old sessions will be signed out.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="New password"
          type="password"
          icon={<Lock className="h-4 w-4" />}
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Input
          label="Confirm password"
          type="password"
          icon={<Lock className="h-4 w-4" />}
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register("confirm")}
        />
        {serverError && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Reset password
        </Button>
      </form>
    </div>
  );
}
