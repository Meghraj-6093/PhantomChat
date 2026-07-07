import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import { refreshAccessToken, api } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { SplashScreen } from "@/components/system/SplashScreen";
import { CommandPalette } from "@/components/system/CommandPalette";
import { InstallPrompt } from "@/components/system/InstallPrompt";
import type { PrivateUser } from "@/types";

const AuthLayout = lazy(() => import("@/features/auth/AuthLayout"));
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/features/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("@/features/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/features/auth/ResetPasswordPage"));
const OAuthCallbackPage = lazy(() => import("@/features/auth/OAuthCallbackPage"));
const AppShell = lazy(() => import("@/features/shell/AppShell"));
const ChatPage = lazy(() => import("@/features/chat/ChatPage"));
const FriendsPage = lazy(() => import("@/features/friends/FriendsPage"));
const DiscoverPage = lazy(() => import("@/features/discover/DiscoverPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
const AdminPage = lazy(() => import("@/features/admin/AdminPage"));
const NotFoundPage = lazy(() => import("@/features/misc/NotFoundPage"));
const EmptyChatPage = lazy(() => import("@/features/chat/EmptyChatPage"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const location = useLocation();
  if (!hydrated) return <SplashScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  if (!hydrated) return <SplashScreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const user = useAuthStore((s) => s.user);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const setUser = useAuthStore((s) => s.setUser);

  // Silent session restore on boot via refresh cookie.
  useEffect(() => {
    (async () => {
      const token = await refreshAccessToken();
      if (token) {
        try {
          const me = await api<PrivateUser>("/users/me");
          setUser(me);
        } catch {
          /* ignore */
        }
      }
      setHydrated();
    })();
  }, [setHydrated, setUser]);

  // Socket lifecycle follows auth state.
  useEffect(() => {
    if (user) {
      connectSocket();
      if ("Notification" in window && Notification.permission === "default") {
        // Ask lazily after first interaction instead of immediately.
        const ask = () => {
          Notification.requestPermission();
          window.removeEventListener("pointerdown", ask);
        };
        window.addEventListener("pointerdown", ask, { once: true });
      }
    } else {
      disconnectSocket();
    }
  }, [user?.id]);

  return (
    <Suspense fallback={<SplashScreen />}>
      <AnimatePresence mode="wait">
        <Routes>
          <Route element={<RedirectIfAuthed><AuthLayout /></RedirectIfAuthed>}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
          <Route path="/auth/callback/:provider" element={<OAuthCallbackPage />} />

          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route path="/" element={<EmptyChatPage />} />
            <Route path="/chat/:chatId" element={<ChatPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/settings/*" element={<SettingsPage />} />
            <Route path="/admin/*" element={<AdminPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AnimatePresence>
      {user && <CommandPalette />}
      <InstallPrompt />
    </Suspense>
  );
}
