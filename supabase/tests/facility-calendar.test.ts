import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
const owner = "92000000-0000-4000-8000-000000000001",
  facility = "92000000-0000-4000-8000-000000000002";
type Result = {
  days: { day: string; total: number }[];
  rows: { id: string; facility_name: string; requestor: string }[];
  total: number;
  month_total: number;
};
async function read(day = "2026-11-01", page = 0, status = "", allowed = true) {
  await db.exec("BEGIN;SET LOCAL ROLE authenticated");
  try {
    await db.query("SELECT set_config('test.allowed',$1,true)", [
      String(allowed),
    ]);
    const r = await db.query<{ result: Result }>(
      "SELECT bfe_office_facility_calendar('2026-11-01',$1,$2,$3,$4) AS result",
      [facility, status, day, page],
    );
    await db.exec("COMMIT");
    return r.rows[0].result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT '${owner}'::uuid$$;
 CREATE FUNCTION bfe_current_roles() RETURNS text[] LANGUAGE sql STABLE AS $$SELECT ARRAY['admin']::text[]$$;
 CREATE FUNCTION bfe_can(m text,a text,s text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('test.allowed',true)='true' AND m='calendar' AND a='view' AND s='association'$$;
 CREATE TABLE members(user_id uuid,name text);
 CREATE TABLE bfe_facilities(id uuid,name text,active boolean);
 CREATE TABLE bfe_bookings(id uuid DEFAULT gen_random_uuid(),owner_id uuid DEFAULT '${owner}',facility_id uuid,status text,starts_at timestamptz,ends_at timestamptz);
 GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
 INSERT INTO members VALUES('${owner}','Synthetic requester');
 INSERT INTO bfe_facilities VALUES('${facility}','Synthetic hall',true);
 INSERT INTO bfe_bookings(facility_id,status,starts_at,ends_at) SELECT '${facility}','Pending','2026-10-31T16:00Z','2026-10-31T17:00Z' FROM generate_series(1,25);
 INSERT INTO bfe_bookings(facility_id,status,starts_at,ends_at) VALUES
 ('${facility}','Approved','2026-11-01T15:30Z','2026-11-01T16:30Z'),
 ('${facility}','Cancelled','2026-10-31T16:00Z','2026-10-31T17:00Z'),
 ('${facility}','Approved','2026-11-30T16:00Z','2026-11-30T17:00Z');`);
  await db.exec(
    await readFile(
      new URL(
        "../migrations/202611100039_office_facility_calendar.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
afterAll(() => db.close());
it("counts the whole month while paginating the selected day beyond twenty records", async () => {
  const r = await read();
  expect(r.total).toBe(27);
  expect(r.month_total).toBe(27);
  expect(r.rows).toHaveLength(20);
  expect((await read("2026-11-01", 1)).rows).toHaveLength(7);
  expect(r.rows[0].requestor).toBe("Synthetic requester");
});
it("uses Philippine date boundaries and shows a booking on every day it overlaps", async () => {
  const r = await read();
  expect(r.days.find((d) => d.day === "2026-11-01")?.total).toBe(27);
  const next = await read("2026-11-02");
  expect(next.total).toBe(1);
  expect(next.days.find((d) => d.day === "2026-11-02")?.total).toBe(1);
  expect((await read("2026-11-30")).total).toBe(0);
});
it("filters status without treating cancelled reservations as pending approvals", async () => {
  expect((await read("2026-11-01", 0, "Pending")).total).toBe(25);
  expect((await read("2026-11-01", 0, "Cancelled")).total).toBe(1);
});
it("requires association calendar access and validates selected day and pagination", async () => {
  await expect(read("2026-11-01", 0, "", false)).rejects.toThrow(
    /access required/,
  );
  await expect(read("2026-12-01")).rejects.toThrow(/day in this month/);
  await expect(read("2026-11-01", -1)).rejects.toThrow(/filters/);
});
