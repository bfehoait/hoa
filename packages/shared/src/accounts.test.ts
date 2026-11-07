import { describe, it, expect } from "vitest";
import {
  notificationGroup,
  relativeNotificationTime,
  shouldSuggestInstall,
  profilePreferencesSchema,
  notificationSchema,
  type AppNotification,
} from "./accounts";
const now = new Date("2026-11-05T08:00:00Z");
const item: AppNotification = {
  id: "41000000-0000-4000-8000-000000000001",
  kind: "account",
  title: "Synthetic notice",
  body: "",
  path: "/more/profile",
  created_at: now.toISOString(),
  read_at: null,
};
describe("own-account presentation contracts", () => {
  it("groups unread, today and earlier records without modifying read state", () => {
    expect(notificationGroup(item, now)).toBe("New");
    expect(
      notificationGroup({ ...item, read_at: now.toISOString() }, now),
    ).toBe("Today");
    expect(
      notificationGroup(
        {
          ...item,
          created_at: "2026-11-01T00:00:00Z",
          read_at: now.toISOString(),
        },
        now,
      ),
    ).toBe("Earlier");
  });
  it("handles future timestamps and invalid relative times", () => {
    expect(
      relativeNotificationTime("2026-11-05T09:00:00Z", now.getTime()),
    ).toBe("Just now");
    expect(relativeNotificationTime("invalid", now.getTime())).toBe(
      "Date unavailable",
    );
    expect(
      relativeNotificationTime("2026-11-05T06:00:00Z", now.getTime()),
    ).toBe("2h");
  });
  it("does not suggest installation on first use, during dismissal, or when installed", () => {
    expect(shouldSuggestInstall(1, 0, false, 100)).toBe(false);
    expect(shouldSuggestInstall(2, 200, false, 100)).toBe(false);
    expect(shouldSuggestInstall(10, 0, true, 100)).toBe(false);
    expect(shouldSuggestInstall(2, 100, false, 100)).toBe(true);
  });
  it("rejects unsafe destinations and invalid profile contact input", () => {
    expect(
      notificationSchema.safeParse({ ...item, path: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(
      profilePreferencesSchema.safeParse({
        display_name: "Sample",
        phone: "invalid-number",
        bio: "",
      }).success,
    ).toBe(false);
    expect(
      profilePreferencesSchema.parse({
        display_name: " Sample ",
        phone: "+63 900 000 0000",
        bio: "",
      }).display_name,
    ).toBe("Sample");
  });
});
