import { describe, expect, it } from "vitest";
import { featureGuideForPath } from "./feature-help";

describe("contextual feature help", () => {
  it.each([
    ["/office/access", "access"],
    ["/developer/access?member=synthetic", "access"],
    ["/office/approvals", "reviews"],
    ["/office/registrations", "registrations"],
    ["/account/payments", "account"],
    ["/office/finance/accounting", "finance"],
    ["/more/lots/synthetic", "lots"],
    ["/services/bookings?record=synthetic", "bookings"],
    ["/security/gate", "passes"],
    ["/services/visitors", "passes"],
    ["/board/updates", "announcements"],
    ["/community", "announcements"],
    ["/board/documents", "documents"],
    ["/board/reports", "reports"],
    ["/directory/market", "market"],
    ["/explore/businesses", "market"],
    ["/explore/workshops", "activities"],
    ["/explore/carpools", "carpool"],
    ["/office/settings", "configuration"],
    ["/driver/profile", "driver-profile"],
    ["/driver", "shuttle"],
    ["/services/team-requests", "requests"],
    ["/more/notifications", "notifications"],
    ["/unrecognized", "overview"],
  ])("resolves %s to its feature instead of another workflow", (path, id) => {
    expect(featureGuideForPath(path).id).toBe(id);
  });
});
