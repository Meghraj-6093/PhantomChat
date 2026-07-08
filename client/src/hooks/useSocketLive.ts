import { useEffect, useState } from "react";
import { isSocketLive } from "@/lib/socket";

/**
 * Reactive view of whether a live Socket.io connection exists. The socket may
 * be created, torn down, and recreated over a session, so rather than wiring
 * into its lifecycle we poll the cheap `isSocketLive()` check. Components use
 * this to disable real-time-only affordances (e.g. calls) on hosts without a
 * persistent socket server, such as serverless deployments.
 */
export function useSocketLive(intervalMs = 3000): boolean {
  const [live, setLive] = useState(isSocketLive);

  useEffect(() => {
    const tick = () => setLive(isSocketLive());
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return live;
}
