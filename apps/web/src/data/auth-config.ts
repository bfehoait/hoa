import { z } from "zod";

// VITE variables are public browser configuration. Never accept a server key.
export function isBrowserKey(key: string): boolean {
  if (key.startsWith("sb_publishable_") && key.length > 20) return true;
  try {
    const payload = JSON.parse(
      atob(key.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")),
    );
    return key.split(".").length === 3 && payload.role === "anon";
  } catch {
    return false;
  }
}
const settingsSchema = z.object({
  url: z.url().refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.pathname === "/"
      );
    } catch {
      return false;
    }
  }),
  key: z.string().refine(isBrowserKey),
});
export function readAuthConfig(env: Record<string, unknown>) {
  // Release builds never present a local demonstration as the member portal.
  const mode =
    env.PROD !== true && env.VITE_APP_MODE === "preview"
      ? "preview"
      : "authenticated";
  const result = settingsSchema.safeParse({
    url: env.VITE_SUPABASE_URL,
    key: env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
  return {
    mode,
    settings: mode !== "preview" && result.success ? result.data : null,
  } as const;
}
export const authConfig = readAuthConfig(import.meta.env);
