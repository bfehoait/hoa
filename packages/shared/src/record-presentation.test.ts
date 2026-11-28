import { expect, it } from "vitest";
import { recordFacts } from "./record-presentation";
it("shows required missing answers, omits blank optional and inactive answers, and never dumps unknown fields", () => {
  const fields = [
    { key: "name", label: "name", required: true },
    { key: "optional", label: "Optional note" },
    {
      key: "plate",
      label: "Plate",
      required: true,
      showWhen: { key: "arrival", in: ["Car"] },
    },
  ];
  expect(
    recordFacts(fields, {
      arrival: "On foot",
      optional: "  ",
      plate: "hidden",
      internal: "private",
    }),
  ).toEqual([{ key: "name", label: "Name", value: "Not provided" }]);
  expect(
    recordFacts(fields, {
      arrival: "Car",
      name: "Synthetic Visitor",
      plate: "SYN 001",
      optional: "Note",
    }),
  ).toHaveLength(3);
});
it("makes dates and times readable without converting date-only answers or identifiers", () => {
  expect(
    recordFacts(
      [
        { key: "date", label: "Date", type: "date" },
        { key: "time", label: "Time", type: "time" },
        { key: "id", label: "Property" },
      ],
      { date: "2026-11-24", time: "17:45", id: "1-01-005" },
    ).map((row) => row.value),
  ).toEqual(["Nov 24, 2026", "5:45 PM", "1-01-005"]);
  expect(
    recordFacts([{ key: "date", label: "Date", type: "date" }], {
      date: "2026-02-30",
    })[0].value,
  ).toBe("2026-02-30");
});
