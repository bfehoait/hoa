import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button, Feedback } from "../../components/UI";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import styles from "./LotRegister.module.css";
const schema = z.object({
  version: z.number().int(),
  can_manage: z.boolean(),
  details: z
    .object({
      admin_reference: z.string(),
      street: z.string(),
      hoa_start: z.string().nullable(),
      area_sqm: z.union([z.number(), z.string()]).nullable(),
      occupancy: z.string(),
      remarks: z.string(),
      additional_statuses: z.string(),
      linear_park: z.boolean(),
    })
    .nullable(),
});
const fields = [
  { key: "admin_reference", label: "Administrative unit reference" },
  { key: "street", label: "Street" },
  { key: "hoa_start", label: "HOA start date", type: "date" },
  {
    key: "area_sqm",
    label: "Verified lot area (square metres)",
    type: "number",
  },
  { key: "occupancy", label: "Occupancy" },
  { key: "additional_statuses", label: "Additional registry statuses" },
  { key: "remarks", label: "Administrative remarks" },
] as const;
export default function PropertyBusinessDetails({ lotId }: { lotId: string }) {
  const auth = useAuth(),
    cache = useQueryClient();
  const [editing, setEditing] = useState<z.infer<typeof schema> | null>(null);
  const query = useQuery({
    queryKey: ["lot-business-details", auth.userId, lotId],
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      schema.parse(
        await featureRpc("bfe_lot_business_details", { p_lot: lotId }),
      ),
  });
  const save = useMutation({
    mutationFn: async (f: FormData) => {
      return featureRpc("bfe_save_lot_business_details", {
        p_lot: lotId,
        p_version: editing?.version,
        p_fields: {
          ...Object.fromEntries(
            fields.map((q) => [q.key, String(f.get(q.key) ?? "")]),
          ),
          linear_park: String(f.get("linear_park") === "on"),
        },
        p_reference: f.get("reference"),
      });
    },
    onSuccess: async () => {
      setEditing(null);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["lot-business-details"] }),
        cache.invalidateQueries({ queryKey: ["registry"] }),
      ]);
    },
  });
  return (
    <section className={`${styles.panel} ${styles.businessPanel}`}>
      <h2>Property business details</h2>
      <p className={styles.note}>
        Recorded separately from import evidence. Ownership corrections and
        account links retain their dedicated review.
      </p>
      <Feedback error={query.error} />
      {query.data && !editing && (
        <>
          <dl>
            {fields.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>
                  {query.data?.details?.[f.key] === ""
                    ? "Not recorded"
                    : (query.data?.details?.[f.key] ?? "Not recorded")}
                </dd>
              </div>
            ))}
            <div>
              <dt>Linear park</dt>
              <dd>
                {query.data.details
                  ? query.data.details.linear_park
                    ? "Yes"
                    : "No"
                  : "Not recorded"}
              </dd>
            </div>
          </dl>
          {query.data.can_manage && (
            <Button
              secondary
              onClick={() => {
                setEditing(query.data);
                save.reset();
              }}
            >
              Edit property details
            </Button>
          )}
        </>
      )}
      {editing && (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(new FormData(e.currentTarget));
          }}
        >
          <fieldset className={styles.form} disabled={save.isPending}>
            {fields.map((f) => (
              <label key={f.key}>
                {f.label}
                {f.key === "occupancy" ? (
                  <select
                    name={f.key}
                    defaultValue={editing.details?.occupancy ?? "Unknown"}
                  >
                    {["Owner occupied", "Tenanted", "Vacant", "Unknown"].map(
                      (o) => (
                        <option key={o}>{o}</option>
                      ),
                    )}
                  </select>
                ) : (
                  <input
                    name={f.key}
                    type={"type" in f ? f.type : "text"}
                    step={f.key === "area_sqm" ? "0.01" : undefined}
                    min={f.key === "area_sqm" ? "0.01" : undefined}
                    maxLength={2000}
                    defaultValue={String(editing.details?.[f.key] ?? "")}
                  />
                )}
              </label>
            ))}
            <label>
              <input
                type="checkbox"
                name="linear_park"
                defaultChecked={editing.details?.linear_park ?? false}
              />
              Linear park lot
            </label>
            <label>
              Verification reference
              <input name="reference" required minLength={3} maxLength={200} />
            </label>
            <Feedback error={save.error} />
            <div className={styles.actions}>
              <Button type="button" secondary onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" pending={save.isPending}>
                Save property details
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
