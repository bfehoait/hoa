import { lazy } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./data/auth";
import { AuthGate, WorkspacePicker } from "./features/auth/AuthGate";
import { previewScope } from "./data/preview-scope";
import { accountPreview } from "./data/account-preview-client";
import UnavailableService from "./components/UnavailableService";

const AppShell = lazy(() => import("./AppShell"));
const AccountInterfacePreview = lazy(
  () => import("./features/developer/AccountInterfacePreview"),
);
const RolePreview = lazy(() =>
  import("./features/developer/RolePreview").then((module) => ({
    default: module.RolePreview,
  })),
);

function ShellRoute() {
  const location = useLocation();
  return location.pathname === "/workspaces" ? (
    <WorkspacePicker />
  ) : (
    <AppShell />
  );
}

export default function ProtectedApplication() {
  const auth = useAuth();
  if (accountPreview)
    return (
      <AuthGate developerOnly>
        <AccountInterfacePreview>
          <AuthGate>
            <ShellRoute />
          </AuthGate>
        </AccountInterfacePreview>
      </AuthGate>
    );
  if (previewScope)
    return (
      <AuthGate developerOnly>
        {!auth.preview ? (
          <UnavailableService title="Role simulation" backHref="/developer" />
        ) : (
          <RolePreview role={previewScope.role}>
            <ShellRoute />
          </RolePreview>
        )}
      </AuthGate>
    );
  if (auth.preview) return <AppShell />;
  return (
    <AuthGate>
      <ShellRoute />
    </AuthGate>
  );
}
