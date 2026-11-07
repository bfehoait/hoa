import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArrowLeft, Eye, LogOut, ShieldCheck } from "lucide-react";
import {
  canOpenPath,
  previewMember,
  type PreviewRole,
} from "../../../../../packages/shared/src/auth";
import { RolePreviewIdentity } from "../../data/auth";
import { AuthFrame } from "../auth/AuthFrame";
import styles from "./DeveloperConsole.module.css";

export const roleLabels: Record<PreviewRole, string> = {
  homeowner: "Homeowner",
  renter: "Renter",
  admin: "HOA administrator",
  board: "BOD / Board",
  security: "Security",
  driver: "Driver",
};
export function RolePreview({
  role,
  children,
}: {
  role: PreviewRole;
  children: ReactNode;
}) {
  const [cache] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={cache}>
      <RolePreviewIdentity role={role}>
        <div data-role-preview className={styles.previewSession}>
          <div
            className={styles.previewBanner}
            role="region"
            aria-label="Role preview session"
          >
            <Eye size={24} aria-hidden="true" />
            <div>
              <strong>Previewing: {roleLabels[role]}</strong>
              <span>Synthetic data</span>
            </div>
            <a href="/developer/roles">
              <LogOut size={20} />
              <span>Exit preview</span>
            </a>
          </div>
          <PreviewRoute role={role}>{children}</PreviewRoute>
        </div>
      </RolePreviewIdentity>
    </QueryClientProvider>
  );
}
function PreviewRoute({
  role,
  children,
}: {
  role: PreviewRole;
  children: ReactNode;
}) {
  const location = useLocation();
  if (
    [
      "/sign-in",
      "/register",
      "/sign-out",
      "/recover",
      "/reset-password",
    ].includes(location.pathname)
  )
    return (
      <AuthFrame>
        <h1>Account actions stay outside preview</h1>
        <p className="muted">
          Exit role preview to manage your real account. No session has been
          changed.
        </p>
        <a href="/developer/roles" className="text-link">
          <ArrowLeft size={20} />
          Exit preview
        </a>
      </AuthFrame>
    );
  if (!canOpenPath(previewMember(role), location.pathname))
    return (
      <AuthFrame>
        <ShieldCheck size={32} />
        <h1>Hidden from this role</h1>
        <p className="muted">
          This page is outside the current frontend access rules for{" "}
          {roleLabels[role]}. This preview does not verify database policies.
        </p>
        <Link
          className="text-link"
          to={
            role === "admin"
              ? "/office"
              : role === "board"
                ? "/board"
                : role === "security"
                  ? "/security"
                  : role === "driver"
                    ? "/driver"
                    : "/"
          }
        >
          Back to role home
          <ArrowLeft size={20} />
        </Link>
      </AuthFrame>
    );
  return children;
}
