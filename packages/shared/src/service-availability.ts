// Presentation readiness only. AuthGate and protected server operations still
// determine who may read or change records.
export function unavailableService(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const unavailable: Record<string, string> = {
    "/office/registry": "Property & household changes",
    "/office/history": "Office activity history",
    "/office/settings": "Office settings",
    "/explore/imports": "Import staging",
    "/explore/calculator": "Billing calculator",
  };
  if (unavailable[path]) return unavailable[path];
  if (path.startsWith("/admin/")) return "Legacy administration";
  if (path.startsWith("/developer/preview/")) return "Role simulation";
  if (
    path.startsWith("/services/") &&
    ![
      "/services/requests",
      "/services/bookings",
      "/services/visitors",
      "/services/inbox",
      "/services/calendar",
    ].includes(path)
  )
    return "Community service";
  if (
    path.startsWith("/office/") &&
    ![
      "/office/access",
      "/office/residents",
      "/office/registrations",
      "/office/requests",
      "/office/inbox",
      "/office/bookings",
      "/office/calendar",
      "/office/visitors",
      "/office/community",
      "/office/announcements",
      "/office/documents",
      "/office/operations",
      "/office/review",
      "/office/vehicles",
      "/office/permits",
    ].includes(path) &&
    !/^\/office\/(lots|finance)(\/|$)/.test(path)
  )
    return "Office service";
  if (
    path.startsWith("/more/") &&
    ![
      "/more/profile",
      "/more/help",
      "/more/notifications",
      "/more/transport",
      "/more/marketplace",
      "/more/training",
      "/more/documents",
      "/more/elections",
      "/more/vehicles",
      "/more/permits",
      "/more/settings",
    ].includes(path) &&
    !/^\/more\/lots(\/|$)/.test(path)
  )
    return "Community service";
  if (
    path.startsWith("/board/") &&
    !["/board/documents", "/board/elections", "/board/shuttle", "/board/reports"].includes(
      path,
    ) &&
    !/^\/board\/updates(\/|$)/.test(path)
  )
    return "Board service";
  if (
    path.startsWith("/security/") &&
    ![
      "/security/gate",
      "/security/visitors",
      "/security/vehicles",
      "/security/incidents",
    ].includes(path)
  )
    return "Security service";
  return null;
}
