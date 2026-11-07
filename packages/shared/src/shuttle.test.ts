import { expect, it } from "vitest";
import { buyaniAccount } from "./payment";
import { shuttleActions, shuttleRequestSchema } from "./shuttle";
it("formats the requested Buyani reference without stripping source account suffixes", () => {
  expect(buyaniAccount(1, 19, 26)).toBe("BF1-019-026");
  expect(buyaniAccount(1, 1, 101)).toBe("BF1-001-101");
  expect(buyaniAccount(1, 0, 2)).toBeNull();
  expect(buyaniAccount(1, 1000, 2)).toBeNull();
});
it("hides late actions and keeps pickup distinct from arrival", () => {
  const id = "78000000-0000-4000-8000-000000000001";
  const row = shuttleRequestSchema.parse({
    id,
    owner_id: id,
    driver_id: id,
    shuttle_code: "Shuttle 1",
    pickup: "Synthetic pickup",
    destination: "Synthetic destination",
    passengers: 1,
    status: "On the way",
    created_at: "2026-11-06T01:00:00Z",
    expires_at: "2026-11-06T02:00:00Z",
    arrived_at: null,
    version: 1,
    reason: null,
    prior_day: false,
  });
  expect(
    shuttleActions(row, false, true, id, Date.parse(row.expires_at)),
  ).toEqual([]);
  expect(
    shuttleActions(
      { ...row, status: "Arrived", arrived_at: "2026-11-06T01:30:00Z" },
      false,
      true,
      id,
      Date.parse("2026-11-06T01:31:00Z"),
    ),
  ).toEqual(["Picked up"]);
  expect(
    shuttleActions(row, false, false, id, Date.parse(row.created_at)),
  ).toEqual([]);
});
