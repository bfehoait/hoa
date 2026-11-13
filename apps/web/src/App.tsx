import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Skeleton } from "./components/UI";
import { useAuth } from "./data/auth";
import { previewScope } from "./data/preview-scope";
import { accountPreview } from "./data/account-preview-client";

const PublicAccess = lazy(() => import("./features/auth/PublicAccess"));
const ProtectedApplication = lazy(() => import("./ProtectedApplication"));
const publicPaths = new Set([
  "/sign-in",
  "/register",
  "/recover",
  "/reset-password",
  "/sign-out",
]);

export function App() {
  const auth = useAuth();
  const location = useLocation();
  useEffect(() => {
    try {
      document.documentElement.dataset.theme =
        localStorage.getItem("bellefort-theme") === "dark" ? "dark" : "light";
    } catch {
      /* Default light theme. */
    }
  }, []);
  const publicScreen =
    !accountPreview &&
    !previewScope &&
    !auth.preview &&
    publicPaths.has(location.pathname);
  return (
    <Suspense fallback={<Skeleton />}>
      {publicScreen ? <PublicAccess /> : <ProtectedApplication />}
    </Suspense>
  );
}
