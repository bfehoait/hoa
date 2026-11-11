import { describe, expect, it } from "vitest";
import { unavailableService } from "./service-availability";

describe("authenticated service readiness", () => {
  it.each([
    "/office/registry",
    "/office/history",
    "/explore/imports",
    "/explore/calculator",
    "/admin/operations",
    "/developer/preview/homeowner/",
    "/office/unknown",
    "/services/unknown",
    "/more/unknown",
    "/board/unknown",
    "/security/unknown",
  ])("does not expose a local demonstration at %s", (path) => {
    expect(unavailableService(path)).toBeTruthy();
    expect(unavailableService(path + "/")).toBeTruthy();
  });
  it.each([
    "/",
    "/account",
    "/account/lots/owned-record",
    "/services",
    "/services/requests",
    "/services/bookings",
    "/services/visitors",
    "/services/inbox",
    "/more/profile",
    "/more/notifications",
    "/more/lots/owned-record",
    "/board/reports",
    "/security/incidents",
    "/office/vehicles",
    "/office/permits",
    "/security/vehicles",
    "/office/finance/collections",
    "/more/settings",
    "/services/calendar",
    "/more/vehicles",
    "/more/permits",
    "/directory/market",
    "/office",
    "/office/requests",
    "/office/review",
    "/office/access",
    "/office/lots/owned-record",
    "/security/gate",
    "/security/visitors",
    "/board/documents",
    "/board/updates/notice",
    "/board/elections",
    "/driver/dispatch",
    "/developer/modules/people",
    "/developer/account-preview/session/",
  ])(
    "leaves a connected surface subject to its normal authorization: %s",
    (path) => {
      expect(unavailableService(path)).toBeNull();
    },
  );
});
