import { Ghost } from "lucide-react";

export function SplashScreen() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-background bg-gradient-aurora">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-brand shadow-glow animate-fade-up">
        <Ghost className="h-10 w-10 text-white" />
      </div>
      <div className="text-center animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight text-gradient">PhantomChat</h1>
        <div className="mt-4 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-primary animate-pulse-dot"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
