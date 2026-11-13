import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
import {
  canOpenPath,
  memberRoles,
  memberHomePath,
} from "../../../../../packages/shared/src/auth";
import { useAuth } from "../../data/auth";
import { Button, ButtonLink } from "../../components/UI";
import { useAccountNavigation } from "../../components/AccountNavigation";
import { AuthFrame } from "./AuthFrame";
import styles from "./Access.module.css";
import { usePermissions } from "../../data/permissions";
import { officeRequirement } from "../../../../../packages/shared/src/permissions";

export function AuthGate({
  children,
  developerOnly = false,
}: {
  children: ReactNode;
  developerOnly?: boolean;
}) {
  const auth = useAuth();
  const location = useLocation();
  const permissions = usePermissions();
  if (auth.preview) return children;
  if (!auth.configured) return <Navigate to="/sign-in" replace />;
  if (auth.recovering) return <Navigate to="/reset-password" replace />;
  if (auth.identityError)
    return (
      <AuthFrame>
        <h1>Connection interrupted</h1>
        <p>
          We could not verify your session. Check your connection and try again.
        </p>
        <div className="form-actions">
          <Button onClick={auth.retry}>Retry verification</Button>
          <ButtonLink tone="danger" to="/sign-out">
            Sign out
          </ButtonLink>
        </div>
      </AuthFrame>
    );
  if (auth.checking || auth.memberPending)
    return (
      <AuthFrame>
        <div role="status" className={styles.connectionNote}>
          <LoaderCircle size={24} className="spin" />
          <p>Checking your account and membership...</p>
        </div>
        <Button secondary onClick={auth.retry}>
          Retry verification
        </Button>
      </AuthFrame>
    );
  if (!auth.userId && developerOnly)
    return (
      <AuthFrame>
        <h1>Sign in to preview roles</h1>
        <p className="muted">An active developer assignment is required.</p>
        <a
          className="text-link"
          href={`/sign-in?next=${encodeURIComponent(window.location.pathname)}`}
        >
          Sign in
          <ArrowRight size={20} />
        </a>
      </AuthFrame>
    );
  if (!auth.userId)
    return (
      <Navigate
        to={`/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  const blocked =
    !auth.member || !memberRoles(auth.member).length || auth.memberError;
  if (blocked)
    return (
      <AuthFrame>
        <span className={styles.authIcon}>
          <ShieldCheck size={28} />
        </span>
        <h1>Your account needs a review</h1>
        <p className="muted">
          {auth.memberError
            ? "We could not verify your membership. Retry or contact the office."
            : !auth.member
              ? "Your login is valid, but it is not linked to a verified member record."
              : auth.member.status !== "Active"
                ? "Your membership is not active. Please contact the office."
                : "No supported workspace role is assigned. Please contact the office."}
        </p>
        <div className="form-actions">
          <Button onClick={auth.retry}>Check again</Button>
          <ButtonLink tone="danger" to="/sign-out">
            <LogOut size={20} />
            Sign out
          </ButtonLink>
        </div>
      </AuthFrame>
    );
  if (
    developerOnly
      ? !memberRoles(auth.member!).includes("developer")
      : !canOpenPath(auth.member!, location.pathname)
  )
    return (
      <AuthFrame>
        <span className={styles.authIcon}>
          <ShieldCheck size={28} />
        </span>
        <h1>This workspace is restricted</h1>
        <p className="muted">Your current roles do not include this page.</p>
        <div className="form-actions">
          <ButtonLink to="/workspaces">
            Back to my account
            <ArrowRight size={20} />
          </ButtonLink>
          <ButtonLink tone="danger" to="/sign-out">
            Sign out
          </ButtonLink>
        </div>
      </AuthFrame>
    );
  if (
    !developerOnly &&
    !auth.rolePreview &&
    (officeRequirement(location.pathname) !== null ||
      !permissions.allowsPath(location.pathname))
  ) {
    if (permissions.isPending)
      return (
        <AuthFrame>
          <div role="status">
            <LoaderCircle className="spin" size={24} />
            <p>Checking your module permissions...</p>
          </div>
        </AuthFrame>
      );
    if (!permissions.allowsPath(location.pathname))
      return (
        <AuthFrame>
          <ShieldCheck size={28} />
          <h1>Module access required</h1>
          <p className="muted">
            {permissions.error?.message ??
              "Your committee assignment does not grant access to this module. Contact the office to review your permissions."}
          </p>
          <div className="form-actions">
            <Button secondary onClick={() => void permissions.refetch()}>
              Check again
            </Button>
            <Link className="text-link" to="/workspaces">
              Back to my account <ArrowRight size={20} />
            </Link>
          </div>
        </AuthFrame>
      );
  }
  return children;
}
// Workspace selection changes navigation only; assigned roles stay server-owned.
export function WorkspacePicker() {
  const auth = useAuth();
  const groups = useAccountNavigation();
  const permissions = usePermissions();
  if (!auth.member)
    return <Navigate to={auth.preview ? "/" : "/sign-in"} replace />;
  if (!auth.preview && !auth.rolePreview && permissions.isPending)
    return (
      <AuthFrame>
        <p role="status">Opening your account...</p>
      </AuthFrame>
    );
  const preferred = memberHomePath(auth.member);
  const destination = permissions.allowsPath(preferred)
    ? preferred
    : (groups[0]?.links[0]?.to ?? "/more/profile");
  if (groups.length < 2) return <Navigate to={destination} replace />;
  return (
    <AuthFrame>
      <h1>Choose your workspace</h1>
      <p>Open the account area you want to use.</p>
      <div className={styles.workspaceChoices}>
        {groups.map((group) => (
          <ButtonLink
            key={group.id}
            to={group.links[0].to}
            tone="secondary"
            block
          >
            {group.title}
            <ArrowRight size={20} aria-hidden="true" />
          </ButtonLink>
        ))}
      </div>
    </AuthFrame>
  );
}
