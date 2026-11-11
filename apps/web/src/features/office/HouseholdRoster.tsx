import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button, Feedback, Skeleton } from "../../components/UI";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import styles from "./MemberWorkspace.module.css";
const occupant = z.object({
  id: z.uuid(),
  lot_id: z.uuid(),
  physical_id: z.string(),
  name: z.string(),
  member_type: z.string(),
  relationship: z.string(),
  phone: z.string(),
  active: z.boolean(),
  version: z.number().int(),
});
const response = z.object({
  can_manage: z.boolean(),
  lots: z.array(z.object({ id: z.uuid(), physical_id: z.string() })),
  rows: z.array(occupant),
  total: z.number().int(),
});
type Occupant = z.infer<typeof occupant>;
export default function HouseholdRoster({
  target,
  onBusy,
  onEditing,
}: {
  target: string;
  onBusy: (value: boolean) => void;
  onEditing: (value: boolean) => void;
}) {
  const auth = useAuth(),
    cache = useQueryClient();
  const [page, setPage] = useState(0),
    [editing, setEditing] = useState<Occupant | null | false>(false),
    [client, setClient] = useState(() => crypto.randomUUID());
  const query = useQuery({
    queryKey: ["household-roster", auth.userId, target, page],
    retry: false,
    gcTime: 0,
    queryFn: async () =>
      response.parse(
        await featureRpc("bfe_household_roster", {
          p_target: target,
          p_page: page,
        }),
      ),
  });
  const save = useMutation({
    mutationFn: async (f: FormData) => {
      return featureRpc("bfe_save_household_occupant", {
        p_id: editing ? editing.id : client,
        p_lot: editing ? editing.lot_id : f.get("lot"),
        p_version: editing ? editing.version : 0,
        p_name: f.get("name"),
        p_type: f.get("type"),
        p_relationship: f.get("relationship"),
        p_phone: f.get("phone"),
        p_active: f.get("active") === "on",
        p_reference: f.get("reference"),
      });
    },
    onSuccess: async () => {
      setEditing(false);
      setClient(crypto.randomUUID());
      await cache.invalidateQueries({ queryKey: ["household-roster"] });
    },
  });
  useEffect(() => {
    onBusy(save.isPending);
  }, [onBusy, save.isPending]);
  useEffect(() => {
    onEditing(editing !== false);
  }, [onEditing, editing]);
  useEffect(
    () => () => {
      onBusy(false);
      onEditing(false);
    },
    [onBusy, onEditing],
  );
  return (
    <section aria-label="Household occupants">
      <h3>Household occupants</h3>
      <p className={styles.note}>
        A roster entry does not create a sign-in account, ownership, property
        access or receipt access.
      </p>
      <Feedback error={query.error} />
      {query.isPending && <Skeleton />}
      {query.data && (
        <>
          {!query.data.lots.length ? (
            <p>
              Link a verified property before maintaining its household roster.
            </p>
          ) : (
            <>
              {query.data.rows.map((r) => (
                <article className={styles.record} key={r.id}>
                  <strong>{r.name}</strong>
                  <p>
                    {r.physical_id} · {r.member_type} · {r.relationship} ·{" "}
                    {r.active ? "Current" : "Ended"}
                  </p>
                  {r.phone && <p>{r.phone}</p>}
                  {query.data?.can_manage && editing === false && (
                    <Button
                      secondary
                      onClick={() => {
                        setEditing(r);
                        save.reset();
                      }}
                    >
                      Edit occupant
                    </Button>
                  )}
                </article>
              ))}
              {!query.data.rows.length && (
                <p>No household occupants recorded.</p>
              )}
              {query.data.can_manage && editing === false && (
                <Button
                  secondary
                  onClick={() => {
                    setEditing(null);
                    setClient(crypto.randomUUID());
                    save.reset();
                  }}
                >
                  Add occupant
                </Button>
              )}
              {editing !== false && (
                <form
                  className={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();
                    save.mutate(new FormData(e.currentTarget));
                  }}
                >
                  <fieldset disabled={save.isPending}>
                    <label>
                      Property
                      <select
                        name="lot"
                        required
                        disabled={!!editing}
                        defaultValue={
                          editing ? editing.lot_id : query.data.lots[0]?.id
                        }
                      >
                        {query.data.lots.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.physical_id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Full name or known name
                      <input
                        name="name"
                        required
                        maxLength={120}
                        defaultValue={editing ? editing.name : ""}
                      />
                    </label>
                    <label>
                      Member type
                      <input
                        name="type"
                        required
                        maxLength={40}
                        defaultValue={editing ? editing.member_type : ""}
                      />
                    </label>
                    <label>
                      Relationship to household
                      <input
                        name="relationship"
                        required
                        maxLength={60}
                        defaultValue={editing ? editing.relationship : ""}
                      />
                    </label>
                    <label>
                      Contact phone
                      <input
                        name="phone"
                        type="tel"
                        maxLength={40}
                        defaultValue={editing ? editing.phone : ""}
                      />
                    </label>
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={editing ? editing.active : true}
                      />
                      Current household occupant
                    </label>
                    <label>
                      Verification reference or correction reason
                      <input
                        name="reference"
                        required
                        minLength={3}
                        maxLength={200}
                      />
                    </label>
                    <Feedback error={save.error} />
                    <div className={styles.actions}>
                      <Button
                        type="button"
                        secondary
                        onClick={() => setEditing(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" pending={save.isPending}>
                        Save occupant
                      </Button>
                    </div>
                  </fieldset>
                </form>
              )}
              {query.data.total > 20 && (
                <div className={styles.actions}>
                  <Button
                    secondary
                    disabled={!page || editing !== false}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous occupants
                  </Button>
                  <span>Page {page + 1}</span>
                  <Button
                    secondary
                    disabled={
                      (page + 1) * 20 >= query.data.total || editing !== false
                    }
                    onClick={() => setPage(page + 1)}
                  >
                    Next occupants
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
