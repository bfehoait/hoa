import { expect, it } from "vitest";
import { officeReviewSchema } from "./office-review";

const queue = (kind: string, module: string) => ({
  kind,
  module,
  pending: 2,
  in_review: 0,
  can_decide: true,
});

it("never treats carpools as an office review queue", () => {
  const parsed = officeReviewSchema.parse({
    queues: [
      queue("feature", "carpools"),
      queue("participation", "carpools"),
      queue("feature", "carpool-interests"),
      queue("feature", "businesses"),
      queue("participation", "workshops"),
    ],
  });
  expect(parsed.queues.map((q) => `${q.kind}:${q.module}`)).toEqual([
    "feature:businesses",
    "participation:workshops",
  ]);
});
