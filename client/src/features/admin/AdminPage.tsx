import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Shield, Users, MessageSquare, Flag, ScrollText, Menu, Ban, Search,
  TrendingUp, Activity, UserX, CircleDot,
} from "lucide-react";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import type { AdminStats, PublicUser } from "@/types";

type Tab = "overview" | "users" | "reports" | "audit";

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const [tab, setTab] = useState<Tab>("overview");

  if (user && user.role !== "ADMIN" && user.role !== "MODERATOR") {
    return <Navigate to="/" replace />;
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "overview", label: "Overview", icon: <Activity className="h-4 w-4" /> },
    { id: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { id: "reports", label: "Reports", icon: <Flag className="h-4 w-4" /> },
    { id: "audit", label: "Audit log", icon: <ScrollText className="h-4 w-4" /> },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 pt-safe">
        <button onClick={() => toggleSidebar(true)} className="text-muted md:hidden" aria-label="Menu">
          <Menu className="h-6 w-6" />
        </button>
        <Shield className="h-5 w-5 text-primary-soft" />
        <h1 className="text-lg font-bold">Admin</h1>
        <span className="rounded-full bg-gradient-brand px-2 py-0.5 text-[10px] font-bold text-white">{user?.role}</span>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
              tab === t.id ? "bg-primary/20 text-primary-soft" : "text-muted hover:bg-slate-700/30 hover:text-slate-100"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4">
        <div className="mx-auto max-w-5xl">
          {tab === "overview" && <Overview />}
          {tab === "users" && <UsersTab />}
          {tab === "reports" && <ReportsTab />}
          {tab === "audit" && <AuditTab />}
        </div>
      </div>
    </div>
  );
}

function Overview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api<AdminStats>("/admin/stats"),
    refetchInterval: 30_000,
  });

  if (isLoading || !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    );
  }

  const cards = [
    { label: "Total users", value: stats.totalUsers, sub: `+${stats.newUsersToday} today`, icon: <Users className="h-5 w-5" />, color: "text-primary-soft" },
    { label: "Online now", value: stats.onlineUsers, sub: "live presence", icon: <CircleDot className="h-5 w-5" />, color: "text-success" },
    { label: "Messages", value: stats.totalMessages, sub: `+${stats.messagesToday} today`, icon: <MessageSquare className="h-5 w-5" />, color: "text-accent-soft" },
    { label: "Chats", value: stats.totalChats, sub: "DMs, groups, channels", icon: <TrendingUp className="h-5 w-5" />, color: "text-primary-soft" },
    { label: "Open reports", value: stats.openReports, sub: "needs review", icon: <Flag className="h-5 w-5" />, color: stats.openReports ? "text-warning" : "text-muted" },
    { label: "Banned users", value: stats.bannedUsers, sub: "enforcement", icon: <UserX className="h-5 w-5" />, color: "text-danger" },
  ];

  const max = Math.max(...stats.messagesPerDay.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{c.label}</span>
              <span className={c.color}>{c.icon}</span>
            </div>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{c.value.toLocaleString()}</p>
            <p className="text-[11px] text-muted">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="mb-4 text-sm font-bold">Messages · last 7 days</h3>
        {stats.messagesPerDay.length === 0 ? (
          <p className="text-xs text-muted">No data yet.</p>
        ) : (
          <div className="flex h-36 items-end gap-2">
            {stats.messagesPerDay.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-muted">{d.count}</span>
                <div
                  style={{ height: `${Math.max((d.count / max) * 100, 4)}%` }}
                  className="w-full max-w-10 rounded-t-lg bg-primary"
                />
                <span className="text-[9px] text-muted">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type AdminUser = PublicUser & { email: string; isBanned: boolean; banReason: string | null; emailVerified: boolean };

function UsersTab() {
  const me = useAuthStore((s) => s.user);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["admin-users", q, page],
    queryFn: () => api<{ items: AdminUser[]; total: number; page: number; pageSize: number }>(
      `/admin/users?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}`
    ),
  });

  const banMutation = useMutation({
    mutationFn: ({ userId, banned, reason }: { userId: string; banned: boolean; reason?: string }) =>
      api(`/admin/users/${userId}/ban`, { body: { banned, reason } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api(`/admin/users/${userId}/role`, { body: { role } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Search by username, email, name…"
          className="input-base pl-10"
        />
      </div>

      <div className="space-y-1.5">
        {data?.items.map((u) => (
          <div key={u.id} className={cn("glass flex flex-wrap items-center gap-3 rounded-2xl p-3", u.isBanned && "opacity-60 ring-1 ring-danger/40")}>
            <Avatar src={u.avatarUrl} name={u.displayName} size="md" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-semibold">
                {u.displayName}
                <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                  u.role === "ADMIN" ? "bg-danger/20 text-danger" : u.role === "MODERATOR" ? "bg-warning/20 text-warning" : "bg-slate-700/40 text-muted")}>
                  {u.role}
                </span>
                {u.isBanned && <span className="rounded-full bg-danger/20 px-1.5 py-0.5 text-[9px] font-bold text-danger">BANNED</span>}
              </p>
              <p className="truncate text-xs text-muted">@{u.username} · {u.email}</p>
            </div>
            {me?.role === "ADMIN" && u.id !== me.id && (
              <select
                value={u.role}
                onChange={(e) => roleMutation.mutate({ userId: u.id, role: e.target.value })}
                className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs"
              >
                <option value="USER">User</option>
                <option value="MODERATOR">Moderator</option>
                <option value="ADMIN">Admin</option>
              </select>
            )}
            {u.id !== me?.id && u.role !== "ADMIN" && (
              <Button
                size="sm"
                variant={u.isBanned ? "secondary" : "danger"}
                onClick={() => {
                  if (u.isBanned) banMutation.mutate({ userId: u.id, banned: false });
                  else {
                    const reason = prompt(`Ban @${u.username}? Reason:`);
                    if (reason !== null) banMutation.mutate({ userId: u.id, banned: true, reason: reason || undefined });
                  }
                }}
              >
                <Ban className="h-3.5 w-3.5" /> {u.isBanned ? "Unban" : "Ban"}
              </Button>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span className="text-xs text-muted">Page {page} / {totalPages}</span>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

interface Report {
  id: string;
  reason: string;
  status: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  reporter: PublicUser;
  target: PublicUser;
}

function ReportsTab() {
  const { data: reports } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => api<Report[]>("/admin/reports"),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Report["status"] }) =>
      api(`/admin/reports/${id}`, { body: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reports"] }),
  });

  if (!reports?.length) {
    return <EmptyState icon={<Flag />} title="No reports" description="User reports about abuse or spam will appear here." />;
  }

  const statusColor: Record<string, string> = {
    OPEN: "bg-warning/20 text-warning",
    REVIEWING: "bg-primary/20 text-primary-soft",
    RESOLVED: "bg-success/20 text-success",
    DISMISSED: "bg-slate-700/40 text-muted",
  };

  return (
    <div className="space-y-2">
      {reports.map((r) => (
        <div key={r.id} className="glass rounded-2xl p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", statusColor[r.status])}>{r.status}</span>
            <span className="text-xs text-muted">{new Date(r.createdAt).toLocaleString()}</span>
          </div>
          <p className="text-sm">
            <span className="font-semibold">@{r.reporter.username}</span> reported{" "}
            <span className="font-semibold text-danger">@{r.target.username}</span>
          </p>
          <p className="mt-1 rounded-xl border border-line bg-background/40 px-3 py-2 text-xs text-muted">{r.reason}</p>
          <div className="mt-3 flex gap-2">
            {r.status === "OPEN" && (
              <Button size="sm" variant="secondary" onClick={() => update.mutate({ id: r.id, status: "REVIEWING" })}>Review</Button>
            )}
            {(r.status === "OPEN" || r.status === "REVIEWING") && (
              <>
                <Button size="sm" variant="success" onClick={() => update.mutate({ id: r.id, status: "RESOLVED" })}>Resolve</Button>
                <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: r.id, status: "DISMISSED" })}>Dismiss</Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface AuditEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl">;
}

function AuditTab() {
  const { data: logs } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => api<AuditEntry[]>("/admin/audit-logs"),
  });

  if (!logs?.length) {
    return <EmptyState icon={<ScrollText />} title="No audit entries" description="Moderation actions are recorded here for accountability." />;
  }

  return (
    <div className="space-y-1">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
          <Avatar src={log.actor.avatarUrl} name={log.actor.displayName} size="xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs">
              <span className="font-semibold">@{log.actor.username}</span>{" "}
              <code className="rounded bg-slate-700/40 px-1 text-[10px] text-accent-soft">{log.action}</code>{" "}
              {log.targetType && <span className="text-muted">{log.targetType} {log.targetId?.slice(0, 8)}…</span>}
            </p>
            {log.metadata && <p className="truncate text-[10px] text-muted/70">{JSON.stringify(log.metadata)}</p>}
          </div>
          <span className="shrink-0 text-[10px] text-muted">{new Date(log.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
