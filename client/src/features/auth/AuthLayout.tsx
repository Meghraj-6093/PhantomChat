import { Outlet } from "react-router-dom";
import { Ghost } from "lucide-react";

export default function AuthLayout() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background bg-gradient-aurora px-4 py-10 pl-safe pr-safe">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 animate-fade-up">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow">
            <Ghost className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient">PhantomChat</h1>
          <p className="text-sm text-muted">Where conversations come alive 👻</p>
        </div>

        <div className="glass rounded-xl3 p-6 sm:p-8 animate-fade-up">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
