import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { unavailableService } from "../../../../packages/shared/src/service-availability";
import { useAuth } from "../data/auth";
import UnavailableService from "./UnavailableService";

export default function ProductionBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const auth = useAuth();
  const { pathname } = useLocation();
  const title =
    !auth.preview && !auth.rolePreview ? unavailableService(pathname) : null;
  return title ? <UnavailableService title={title} /> : children;
}
