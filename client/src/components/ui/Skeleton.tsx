import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function ChatListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl p-2.5">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessagesSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={cn("flex gap-3", i % 3 === 2 && "flex-row-reverse")}>
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-2">
            <Skeleton className={cn("h-4", i % 2 ? "w-48" : "w-64")} />
            <Skeleton className={cn("h-4", i % 2 ? "w-32" : "w-40")} />
          </div>
        </div>
      ))}
    </div>
  );
}
