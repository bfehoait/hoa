import { describe, expect, it } from "vitest";
import {
  assignedRoleLabels,
  directoryMemberSchema,
  literalSearch,
} from "./people";

describe("staff directory contracts", () => {
  const record = {
    id: "sample-member",
    user_id: null,
    name: null,
    email: null,
    phone: null,
    unit: null,
    title: null,
    role: "renter",
    extra_roles: ["admin", "renter"],
    status: "Active",
    last_seen: null,
  };
  it("accepts unlinked members without inventing identity or property verification", () => {
    const result = directoryMemberSchema.parse(record);
    expect(result.user_id).toBeNull();
    expect(result.unit).toBeNull();
    expect(
      directoryMemberSchema.safeParse({ ...record, user_id: "bad-link" })
        .success,
    ).toBe(false);
  });
  it("shows primary and extra assignments without duplicate badges", () => {
    expect(assignedRoleLabels(record)).toEqual(["renter", "admin"]);
  });
  it("treats wildcard input literally and bounds search length", () => {
    expect(literalSearch("  10%_\\  ")).toBe("10\\%\\_\\\\");
    expect(literalSearch("a".repeat(200))).toHaveLength(100);
  });
});
