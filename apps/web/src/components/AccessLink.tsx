import type { RefAttributes } from "react";
import {
  Link as RouterLink,
  useLocation,
  type LinkProps,
} from "react-router-dom";
import {
  canOpenPath,
  type AuthMember,
} from "../../../../packages/shared/src/auth";
import { useAuth } from "../data/auth";
import { usePermissions } from "../data/permissions";

export function visibleDestination(
  member: AuthMember | null,
  target: string,
  current: string,
  rolePreview: boolean,
) {
  if (!member) return true;
  if (target.startsWith("//") || /[\\\r\n]/.test(target)) return false;
  let url: URL;
  try {
    url = new URL(target, "https://route.invalid" + current);
  } catch {
    return false;
  }
  if (url.origin !== "https://route.invalid") return !rolePreview;
  const path = url.pathname;
  const accountAction = [
    "/sign-in",
    "/sign-out",
    "/register",
    "/recover",
    "/reset-password",
  ].includes(path);
  if (accountAction) return !rolePreview;
  return canOpenPath(member, target.startsWith("/") ? target : path);
}
// UI visibility only. AuthGate and server policies remain independent checks.
export function Link(props: LinkProps & RefAttributes<HTMLAnchorElement>) {
  const auth = useAuth();
  const location = useLocation();
  const permissions = usePermissions();
  const path =
    typeof props.to === "string" ? props.to : (props.to.pathname ?? "");
  if (
    !auth.preview &&
    (!permissions.allowsPath(path) ||
      !visibleDestination(
        auth.member,
        path,
        location.pathname,
        !!auth.rolePreview,
      ))
  )
    return null;
  return <RouterLink {...props} />;
}
