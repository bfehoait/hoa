import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const statusSchema = z.discriminatedUnion("valid", [
  z.object({ valid: z.literal(false) }),
  z.object({
    valid: z.literal(true),
    expires_at: z.iso.datetime({ offset: true }),
    idle_expires_at: z.iso.datetime({ offset: true }),
    server_now: z.iso.datetime({ offset: true }),
  }),
]);
export class SessionExpiredError extends Error {}

export async function readSessionPolicy(
  client: SupabaseClient,
  touch: boolean,
  signal?: AbortSignal,
) {
  const requestAbort = new AbortController();
  const abort = () => requestAbort.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = window.setTimeout(abort, 10_000);
  let response;
  try {
    response = await client
      .rpc("bfe_session_status", { p_touch: touch })
      .abortSignal(requestAbort.signal);
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
  const { data, error } = response;
  if (error) {
    if (error.code === "PT401")
      throw new SessionExpiredError(
        "Your session expired. Please sign in again.",
      );
    throw new Error("We could not check your session. Please retry.");
  }
  const status = statusSchema.parse(data);
  if (!status.valid)
    throw new SessionExpiredError(
      "Your session expired. Please sign in again.",
    );
  return status;
}

/** Polls only CHECK validity. Trusted foreground input may advance activity. */
export function useSessionActivity(
  client: SupabaseClient | null,
  userId: string | null,
  onExpired: () => void,
  onUnavailable: () => void,
  onVerified: () => void,
) {
  useEffect(() => {
    if (!client || !userId) return;
    const controller = new AbortController();
    let live = true;
    let inFlight = false;
    let activityVersion = 0;
    let savedVersion = 0;
    let lastTouch = -Infinity;
    let deadline: number | undefined;
    const check = async (touch: boolean) => {
      if (!live || inFlight) return;
      inFlight = true;
      const version = activityVersion;
      try {
        const status = await readSessionPolicy(
          client,
          touch,
          controller.signal,
        );
        if (!live) return;
        if (touch) {
          savedVersion = version;
          lastTouch = performance.now();
        }
        onVerified();
        window.clearTimeout(deadline);
        const remaining =
          Math.min(
            Date.parse(status.expires_at),
            Date.parse(status.idle_expires_at),
          ) - Date.parse(status.server_now);
        // Use the server's clock delta, not the browser's wall clock.
        deadline = window.setTimeout(
          () => void check(false),
          Math.max(0, Math.min(remaining, 2_147_000_000)),
        );
      } catch (error) {
        if (!live) return;
        if (error instanceof SessionExpiredError) onExpired();
        else onUnavailable();
      } finally {
        inFlight = false;
      }
    };
    const input = (event: Event) => {
      if (!event.isTrusted || document.visibilityState !== "visible") return;
      activityVersion++;
      if (performance.now() - lastTouch >= 60_000) void check(true);
    };
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      activityVersion++;
      void check(true);
    };
    const focus = () => {
      if (document.visibilityState === "visible") void check(false);
    };
    for (const event of ["pointerdown", "keydown", "wheel"])
      document.addEventListener(event, input, { passive: true });
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void check(activityVersion > savedVersion);
    }, 60_000);
    void check(false);
    return () => {
      live = false;
      controller.abort();
      window.clearInterval(timer);
      window.clearTimeout(deadline);
      for (const event of ["pointerdown", "keydown", "wheel"])
        document.removeEventListener(event, input);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
    };
  }, [client, userId, onExpired, onUnavailable, onVerified]);
}
