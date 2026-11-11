import { describe, expect, it } from "vitest";
import {
  canOpenPath,
  memberRoles,
  memberSchema,
  memberWorkspaces,
  memberHomePath,
  newPasswordSchema,
  safeReturnPath,
  signInSchema,
  type AuthMember,
  rolePreviewScope,
  previewMember,
  isBoardWorkspacePath,
} from "./auth";
import {
  isBrowserKey,
  readAuthConfig,
} from "../../../apps/web/src/data/auth-config";

const member: AuthMember = {
  id: "synthetic-member",
  user_id: "11111111-1111-4111-8111-111111111111",
  name: "Synthetic Member",
  unit: "Sample A",
  role: "homeowner",
  extra_roles: [],
  status: "Active",
};
describe("identity and member boundaries", () => {
  it("allows resident feature entry points while keeping authority proposals restricted", () => {
    expect(canOpenPath(member, "/explore/businesses")).toBe(true);
    expect(canOpenPath(member, "/explore/participation")).toBe(true);
    expect(canOpenPath(member, "/explore/election-setup")).toBe(false);
    expect(canOpenPath(member, "/explore/access-proposals")).toBe(false);
  });
  it("opens a primary home directly while retaining every assigned area", () => {
    const mixed = { ...member, extra_roles: ["board"] };
    expect(memberHomePath(mixed)).toBe("/");
    expect(memberWorkspaces(mixed).map((area) => area.id)).toEqual([
      "resident",
      "board",
    ]);
    expect(
      memberHomePath({ ...mixed, role: "board", extra_roles: ["homeowner"] }),
    ).toBe("/board");
  });
  it("opens developer tools directly and exposes More without granting household pages", () => {
    expect(memberHomePath({ ...member, extra_roles: ["developer"] })).toBe(
      "/developer",
    );
    const security = { ...member, role: "security" };
    expect(memberHomePath(security)).toBe("/security");
    expect(canOpenPath(security, "/more")).toBe(true);
    expect(canOpenPath(security, "/account")).toBe(false);
    expect(canOpenPath(security, "/services")).toBe(false);
    expect(canOpenPath({ ...security, status: "Suspended" }, "/more")).toBe(
      false,
    );
  });
  it("normalizes email but preserves password spaces", () => {
    expect(
      signInSchema.parse({
        email: "  sample@example.invalid ",
        password: " synthetic ",
      }),
    ).toEqual({ email: "sample@example.invalid", password: " synthetic " });
  });
  it("requires a valid auth UUID and does not accept claimed roles as arrays", () => {
    expect(memberSchema.safeParse({ ...member, user_id: null }).success).toBe(
      false,
    );
    expect(
      memberSchema.safeParse({ ...member, extra_roles: "admin" }).success,
    ).toBe(false);
  });
  it("requires matching new passwords", () => {
    expect(
      newPasswordSchema.safeParse({
        password: "synthetic-long-value",
        confirmation: "different",
      }).success,
    ).toBe(false);
  });
  for (const status of ["Suspended", "Pending", "Inactive", "active", ""])
    it(`denies non-active membership: ${status}`, () => {
      expect(memberRoles({ ...member, status })).toEqual([]);
      expect(canOpenPath({ ...member, status }, "/")).toBe(false);
    });
  it("reads extra roles only from the supplied server member record", () => {
    expect(
      memberRoles({ ...member, extra_roles: ["admin", "admin", "unknown"] }),
    ).toEqual(["homeowner", "admin"]);
  });
  it("denies unknown roles and does not invent a staff/admin mapping", () => {
    expect(
      memberWorkspaces({ ...member, role: "staff", extra_roles: [] }),
    ).toEqual([]);
  });
  it("keeps office, field and household workspaces separate", () => {
    expect(canOpenPath(member, "/office/finance")).toBe(false);
    expect(canOpenPath({ ...member, role: "security" }, "/")).toBe(false);
    expect(canOpenPath({ ...member, role: "board" }, "/office/access")).toBe(
      false,
    );
    expect(canOpenPath({ ...member, role: "board" }, "/more/documents")).toBe(
      true,
    );
    expect(canOpenPath({ ...member, role: "admin" }, "/developer")).toBe(false);
  });
  it("requires a separate active developer assignment", () => {
    const developer = { ...member, role: "developer", extra_roles: [] };
    expect(canOpenPath(developer, "/developer/connections")).toBe(true);
    expect(canOpenPath(developer, "/office/finance")).toBe(true);
    expect(canOpenPath(developer, "/security")).toBe(true);
    expect(canOpenPath(developer, "/directory/market")).toBe(true);
    expect(canOpenPath({ ...member, role: "admin" }, "/directory/market")).toBe(
      true,
    );
    expect(
      canOpenPath({ ...member, role: "security" }, "/directory/market"),
    ).toBe(true);
    expect(canOpenPath({ ...member, role: "admin" }, "/account")).toBe(false);
    expect(
      canOpenPath({ ...developer, status: "Suspended" }, "/developer"),
    ).toBe(false);
    expect(
      memberWorkspaces({ ...member, extra_roles: ["developer"] }).map(
        (item) => item.id,
      ),
    ).toEqual([
      "developer",
      "resident",
      "office",
      "board",
      "security",
      "driver",
    ]);
  });
  it("preserves board navigation on shared documents/elections without granting new access", () => {
    const board = { ...member, role: "board" };
    expect(isBoardWorkspacePath(board, "/board/documents")).toBe(true);
    expect(isBoardWorkspacePath(board, "/more/documents")).toBe(true);
    expect(isBoardWorkspacePath(board, "/more/elections")).toBe(true);
    expect(isBoardWorkspacePath(board, "/directory/governance")).toBe(true);
    expect(isBoardWorkspacePath(member, "/more/documents")).toBe(false);
    expect(canOpenPath(board, "/office/access")).toBe(false);
  });
  it("recognizes only bounded supported role-preview prefixes", () => {
    expect(rolePreviewScope("/developer/preview/board/more/documents")).toEqual(
      { role: "board", basename: "/developer/preview/board" },
    );
    for (const path of [
      "/developer/preview/developer",
      "/developer/preview/admin-other",
      "/developer/preview/%62oard",
      "/?role=admin",
      "/developer/preview/",
    ])
      expect(rolePreviewScope(path)).toBeNull();
  });
  it("synthetic preview identity never inherits the developer or office role", () => {
    expect(memberRoles(previewMember("board"))).toEqual(["board"]);
    expect(canOpenPath(previewMember("board"), "/office/access")).toBe(false);
    expect(canOpenPath(previewMember("admin"), "/developer")).toBe(false);
    expect(previewMember("homeowner").extra_roles).toEqual([]);
  });
  for (const path of [
    "/%6fffice/finance",
    "/foo/../office",
    "/%2foffice",
    "/%2553ecurity",
    "/\\office",
    "//outside.invalid",
    "/%ZZ",
  ])
    it(`does not bypass role checks through path encoding: ${path}`, () => {
      expect(canOpenPath(member, path)).toBe(false);
    });
  it("returns only a permitted internal destination", () => {
    expect(safeReturnPath("https://outside.invalid", member)).toBe(
      "/workspaces",
    );
    expect(safeReturnPath("/office", member)).toBe("/workspaces");
    expect(safeReturnPath("/sign-out", member)).toBe("/workspaces");
    expect(safeReturnPath("/account?tab=bills", member)).toBe(
      "/account?tab=bills",
    );
  });
  it("requires explicit preview mode and defaults to disabled real auth without configuration", () => {
    expect(readAuthConfig({})).toEqual({
      mode: "authenticated",
      settings: null,
    });
    expect(readAuthConfig({ VITE_APP_MODE: "preview" }).mode).toBe("preview");
    for (const url of ["", "not-a-url", "https://", " "]) {
      expect(
        readAuthConfig({
          VITE_SUPABASE_URL: url,
          VITE_SUPABASE_PUBLISHABLE_KEY:
            "sb_publishable_synthetic_testing_only",
        }),
      ).toEqual({ mode: "authenticated", settings: null });
      expect(
        readAuthConfig({
          VITE_APP_MODE: "preview",
          VITE_SUPABASE_URL: url,
          VITE_SUPABASE_PUBLISHABLE_KEY: "",
        }),
      ).toEqual({ mode: "preview", settings: null });
    }
  });
  it("rejects server keys, malformed keys and insecure project URLs", () => {
    expect(readAuthConfig({ PROD: true, VITE_APP_MODE: "preview" })).toEqual({
      mode: "authenticated",
      settings: null,
    });
    expect(isBrowserKey("sb_secret_synthetic_forbidden")).toBe(false);
    const legacy = `e30.${btoa(JSON.stringify({ role: "service_role" }))}.synthetic`;
    expect(isBrowserKey(legacy)).toBe(false);
    expect(
      readAuthConfig({
        VITE_SUPABASE_URL: "http://example.invalid",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_testing_only",
      }).settings,
    ).toBeNull();
  });
});
