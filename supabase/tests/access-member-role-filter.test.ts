import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
type Result = {
  total: number;
  lookup_mode: string;
  rows: { role: string; extra_roles: string[] }[];
};
async function read(role = "", page = 0, allowed = true, search = "") {
  await db.exec("BEGIN;SET LOCAL ROLE authenticated");
  try {
    await db.query("SELECT set_config('test.allowed',$1,true)", [
      String(allowed),
    ]);
    const r = await db.query<{ result: Result }>(
      "SELECT bfe_filtered_access_members($1,$2,$3) AS result",
      [search, role, page],
    );
    await db.exec("COMMIT");
    return r.rows[0].result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;
 CREATE FUNCTION bfe_is_access_manager() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('test.allowed',true)='true'$$;
 CREATE TABLE members(user_id uuid,name text,unit text,role text,extra_roles text[],status text,email text);
 INSERT INTO members SELECT gen_random_uuid(),'Synthetic '||n,'SYNTHETIC','admin',ARRAY['security'],'Active','synthetic'||n||'@example.invalid' FROM generate_series(1,25)n;
 INSERT INTO members VALUES(NULL,'Unlinked synthetic','SYNTHETIC','admin','{}','Active','unlinked@example.invalid');`);
  await db.exec(
    await readFile(
      new URL(
        "../migrations/202611100040_access_member_role_filter.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
afterAll(() => db.close());
it("filters primary and extra roles across every page and excludes unlinked members", async () => {
  expect((await read("admin")).total).toBe(25);
  expect((await read("security")).rows).toHaveLength(20);
  expect((await read("security", 1)).rows).toHaveLength(5);
  expect((await read("driver")).total).toBe(0);
});
it("retains exact email lookup and combines it with the role filter", async () => {
  const r = await read("security", 0, true, " SYNTHETIC1@example.invalid ");
  expect(r.total).toBe(1);
  expect(r.lookup_mode).toBe("email_exact");
  expect(
    (await read("driver", 0, true, "synthetic1@example.invalid")).total,
  ).toBe(0);
});
it("requires access-manager authority and validates filters", async () => {
  await expect(read("admin", 0, false)).rejects.toThrow(/Access manager/);
  await expect(read("unknown")).rejects.toThrow(/filters/);
  await expect(read("admin", -1)).rejects.toThrow(/filters/);
});
it("excludes duplicate sign-in links instead of returning ambiguous accounts", async () => {
  await db.exec(
    "INSERT INTO members SELECT * FROM members WHERE email='synthetic1@example.invalid'",
  );
  expect((await read("admin")).total).toBe(24);
});
