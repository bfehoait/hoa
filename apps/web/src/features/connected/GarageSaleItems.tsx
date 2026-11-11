import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import {
  Badge,
  Button,
  Feedback,
  Modal,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import styles from "../office/MemberWorkspace.module.css";
const itemSchema = z.object({
  id: z.uuid(),
  record_id: z.uuid(),
  title: z.string(),
  detail: z.string(),
  condition: z.string(),
  quantity: z.number().int(),
  price_centavos: z.string(),
  status: z.string(),
  version: z.number().int(),
  review_note: z.string(),
  sale_title: z.string(),
  can_edit: z.boolean(),
  can_review: z.boolean(),
  can_moderate: z.boolean(),
  can_publish: z.boolean(),
});
const decimalPrice = (value: string) =>
  `${BigInt(value) / 100n}.${String(BigInt(value) % 100n).padStart(2, "0")}`;
const displayPrice = (value: string) =>
  `₱${new Intl.NumberFormat("en-PH").format(BigInt(value) / 100n)}.${String(BigInt(value) % 100n).padStart(2, "0")}`;
type Item = z.infer<typeof itemSchema>;
const schema = z.object({
  total: z.number().int(),
  can_create: z.boolean(),
  rows: z.array(itemSchema),
});
export default function GarageSaleItems({
  recordId,
  office = false,
  readOnly = false,
}: {
  recordId?: string;
  office?: boolean;
  readOnly?: boolean;
}) {
  const auth = useAuth(),
    cache = useQueryClient(),
    formId = useId();
  const [page, setPage] = useState(0),
    [editing, setEditing] = useState<Item | null | false>(false),
    [client, setClient] = useState(() => crypto.randomUUID()),
    [decision, setDecision] = useState<{ item: Item; status: string } | null>(
      null,
    ),
    [notice, setNotice] = useState("");
  const sample = auth.preview || !!auth.rolePreview || !!auth.memberPreview;
  const query = useQuery({
    queryKey: ["garage-items", auth.userId, recordId, office, page],
    enabled: !sample,
    gcTime: 0,
    retry: false,
    refetchInterval: editing === false && !decision ? 30000 : false,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      schema.parse(
        await featureRpc("bfe_garage_items", {
          p_record: recordId ?? null,
          p_office: office,
          p_page: page,
        }),
      ),
  });
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: ["garage-items"] });
    await cache.invalidateQueries({ queryKey: ["office-review-inbox"] });
  };
  const save = useMutation({
    mutationFn: async (f: FormData) => {
      await featureRpc("bfe_save_garage_item", {
        p_id: editing ? editing.id : client,
        p_record: editing ? editing.record_id : recordId,
        p_version: editing ? editing.version : 0,
        p_title: f.get("title"),
        p_detail: f.get("detail"),
        p_condition: f.get("condition"),
        p_quantity: Number(f.get("quantity")),
        p_price: f.get("price"),
        p_reference: f.get("reference"),
      });
    },
    onSuccess: async () => {
      setEditing(false);
      setClient(crypto.randomUUID());
      setNotice(
        "Item submitted for Office review. It is not public until published.",
      );
      await refresh();
    },
  });
  const decide = useMutation({
    mutationFn: async (f: FormData) => {
      if (!decision) throw new Error("Reopen the item decision.");
      await featureRpc("bfe_decide_garage_item", {
        p_id: decision.item.id,
        p_version: decision.item.version,
        p_status: decision.status,
        p_reference: f.get("reference"),
      });
    },
    onSuccess: async () => {
      setDecision(null);
      setNotice("Item decision saved by the server.");
      await refresh();
    },
  });
  if (sample)
    return (
      <p className="note">
        Item records require a direct sign-in; this preview does not submit or
        publish them.
      </p>
    );
  return (
    <section>
      {office && !recordId ? (
        <PageIntro
          title="Garage sale items"
          description="Review individual items. Publish the parent sale before making an item public."
        />
      ) : (
        <h3>Items in this sale</h3>
      )}
      <Feedback error={query.error} message={notice} />
      {query.isPending && <Skeleton />}
      {query.isError && (
        <Button secondary onClick={() => void query.refetch()}>
          Retry item records
        </Button>
      )}
      {query.data && (
        <>
          {query.data.can_create && !readOnly && (
            <Button
              onClick={() => {
                setEditing(null);
                setClient(crypto.randomUUID());
                save.reset();
              }}
            >
              Add sale item
            </Button>
          )}
          {!query.data.rows.length && (
            <p>
              {office
                ? "No item records awaiting display."
                : "No separate published items to show. See the sale description for further details."}
            </p>
          )}
          {query.data.rows.map((i) => (
            <article className={styles.record} key={i.id}>
              <strong>{i.title}</strong> <Badge>{i.status}</Badge>
              {office && <p>{i.sale_title}</p>}
              <p>
                {i.condition} · Quantity {i.quantity} ·{" "}
                {displayPrice(i.price_centavos)}
              </p>
              <p>{i.detail}</p>
              {(i.can_edit || i.can_review) && i.review_note && (
                <p>Review: {i.review_note}</p>
              )}
              <div className={styles.actions}>
                {!readOnly && i.can_edit && (
                  <Button
                    secondary
                    onClick={() => {
                      setEditing(i);
                      save.reset();
                    }}
                  >
                    Edit item
                  </Button>
                )}
                {!readOnly && i.can_review && (
                  <>
                    <Button
                      disabled={!i.can_publish}
                      onClick={() => {
                        setDecision({ item: i, status: "Published" });
                        decide.reset();
                      }}
                    >
                      Approve & publish item
                    </Button>
                    <Button
                      secondary
                      onClick={() => {
                        setDecision({ item: i, status: "Rejected" });
                        decide.reset();
                      }}
                    >
                      Reject item
                    </Button>
                  </>
                )}
                {!readOnly &&
                  (i.can_edit || i.can_moderate) &&
                  i.status !== "Withdrawn" && (
                    <Button
                      secondary
                      onClick={() => {
                        setDecision({ item: i, status: "Withdrawn" });
                        decide.reset();
                      }}
                    >
                      Withdraw item
                    </Button>
                  )}
              </div>
              {i.can_review && !i.can_publish && (
                <p className="note">
                  The sale must be published and unexpired before this item can
                  be published.
                </p>
              )}
            </article>
          ))}
          {query.data.total > 20 && (
            <div className={styles.actions}>
              <Button
                secondary
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span>Page {page + 1}</span>
              <Button
                secondary
                disabled={(page + 1) * 20 >= query.data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      {editing !== false && (
        <Modal
          title={editing ? "Edit sale item" : "Add sale item"}
          busy={save.isPending}
          protectChanges
          onClose={() => setEditing(false)}
          footer={
            <>
              <Button
                secondary
                disabled={save.isPending}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit" form={formId} pending={save.isPending}>
                Submit item for review
              </Button>
            </>
          }
        >
          <p>
            Changing a published item removes it from public display until
            Office publishes the revised item.
          </p>
          <form
            id={formId}
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(new FormData(e.currentTarget));
            }}
          >
            <fieldset disabled={save.isPending}>
              <label>
                Item name
                <input
                  name="title"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={editing ? editing.title : ""}
                />
              </label>
              <label>
                Description
                <textarea
                  name="detail"
                  required
                  minLength={5}
                  maxLength={2000}
                  defaultValue={editing ? editing.detail : ""}
                />
              </label>
              <label>
                Condition
                <select
                  name="condition"
                  required
                  defaultValue={editing ? editing.condition : ""}
                >
                  <option value="">Choose</option>
                  {["New", "Like new", "Good", "Fair", "For repair"].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Quantity
                <input
                  name="quantity"
                  type="number"
                  required
                  min={1}
                  max={10000}
                  step={1}
                  defaultValue={editing ? editing.quantity : 1}
                />
              </label>
              <label>
                Price per item (PHP)
                <input
                  name="price"
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  defaultValue={
                    editing ? decimalPrice(editing.price_centavos) : ""
                  }
                />
              </label>
              <label>
                Submission reference or reason
                <input
                  name="reference"
                  required
                  minLength={3}
                  maxLength={200}
                />
              </label>
              <Feedback error={save.error} />
            </fieldset>
          </form>
        </Modal>
      )}
      {decision && (
        <Modal
          title={
            decision.status === "Published"
              ? "Publish this item?"
              : decision.status === "Rejected"
                ? "Reject this item?"
                : "Withdraw this item?"
          }
          busy={decide.isPending}
          protectChanges
          onClose={() => setDecision(null)}
        >
          <p>{decision.item.title}</p>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              decide.mutate(new FormData(e.currentTarget));
            }}
          >
            <fieldset disabled={decide.isPending}>
              <label>
                Decision reason or reference
                <input
                  name="reference"
                  required
                  minLength={3}
                  maxLength={200}
                />
              </label>
              <Feedback error={decide.error} />
              <Button type="submit" pending={decide.isPending}>
                Confirm decision
              </Button>
            </fieldset>
          </form>
        </Modal>
      )}
    </section>
  );
}
