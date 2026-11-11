import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { NavigationGroup } from "../../components/Navigation";
import { Button, Feedback, PageIntro, Skeleton } from "../../components/UI";
import { featureRpc } from "../../data/feature-records";
import { useAuth } from "../../data/auth";
import styles from "./MemberWorkspace.module.css";
const associationSchema = z.object({
  can_manage: z.boolean(),
  rows: z.array(
    z.object({
      name: z.string(),
      address: z.string(),
      office_hours: z.string(),
      quiet_hours: z.string(),
      version: z.number().int(),
    }),
  ),
});
const contactSchema = z.object({
  id: z.uuid(),
  group_name: z.string(),
  name: z.string(),
  phone: z.string(),
  label: z.string(),
  active: z.boolean(),
  version: z.number().int(),
});
const contactsSchema = z.object({
  can_manage: z.boolean(),
  rows: z.array(contactSchema),
});
export default function OfficeConfiguration({
  contacts = false,
}: {
  contacts?: boolean;
}) {
  return (
    <>
      <PageIntro
        title={contacts ? "Hotline management" : "Association settings"}
        description={
          contacts
            ? "Maintain approved contacts for residents. Changes are recorded with their source reference."
            : "Record the association's approved details. Blank hours remain unavailable; no billing rules are changed here."
        }
      />
      <NavigationGroup aria-label="Office configuration">
        <NavLink to="/office/settings">Association</NavLink>
        <NavLink to="/office/hotlines">Hotlines</NavLink>
      </NavigationGroup>
      {contacts ? <Contacts /> : <Association />}
    </>
  );
}
function Association() {
  const auth = useAuth(),
    cache = useQueryClient();
  const [editing, setEditing] = useState<
      z.infer<typeof associationSchema>["rows"][number] | null | false
    >(false),
    [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["office-configuration", auth.userId, "association"],
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      associationSchema.parse(
        await featureRpc("bfe_office_configuration", { p_kind: "association" }),
      ),
  });
  const save = useMutation({
    mutationFn: async (f: FormData) => {
      return featureRpc("bfe_save_association_details", {
        p_version: editing ? editing.version : 0,
        p_name: f.get("name"),
        p_address: f.get("address"),
        p_hours: f.get("office_hours"),
        p_quiet: f.get("quiet_hours"),
        p_reference: f.get("reference"),
      });
    },
    onSuccess: async () => {
      setEditing(false);
      setNotice("Association details saved by the server.");
      await cache.invalidateQueries({ queryKey: ["office-configuration"] });
    },
  });
  const record = query.data?.rows[0];
  return (
    <section className="panel">
      <Feedback error={query.error} message={notice} />
      {query.isPending && <Skeleton />}
      {query.data && editing === false && (
        <>
          <dl className={styles.details}>
            {(["name", "address", "office_hours", "quiet_hours"] as const).map(
              (k) => (
                <div key={k}>
                  <dt>
                    {
                      {
                        name: "Association name",
                        address: "Registered address",
                        office_hours: "Office hours",
                        quiet_hours: "Quiet hours",
                      }[k]
                    }
                  </dt>
                  <dd>{record?.[k] || "Not recorded"}</dd>
                </div>
              ),
            )}
          </dl>
          {query.data.can_manage && (
            <Button
              onClick={() => {
                setEditing(record ?? null);
                save.reset();
              }}
            >
              Edit association details
            </Button>
          )}
        </>
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
            {(["name", "address", "office_hours", "quiet_hours"] as const).map(
              (k) => (
                <label key={k}>
                  {
                    {
                      name: "Association name",
                      address: "Registered address",
                      office_hours: "Office hours",
                      quiet_hours: "Quiet hours",
                    }[k]
                  }
                  <input
                    name={k}
                    required={k === "name"}
                    minLength={k === "name" ? 3 : undefined}
                    maxLength={k === "name" ? 120 : 500}
                    defaultValue={editing ? editing[k] : ""}
                  />
                </label>
              ),
            )}
            <label>
              Approval or verification reference
              <input name="reference" required minLength={3} maxLength={200} />
            </label>
            <Feedback error={save.error} />
            <div className={styles.actions}>
              <Button type="button" secondary onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" pending={save.isPending}>
                Save settings
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
function Contacts() {
  const auth = useAuth(),
    cache = useQueryClient();
  const [editing, setEditing] = useState<
      z.infer<typeof contactSchema> | null | false
    >(false),
    [client, setClient] = useState(() => crypto.randomUUID()),
    [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["office-configuration", auth.userId, "contacts"],
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      contactsSchema.parse(
        await featureRpc("bfe_office_configuration", { p_kind: "contacts" }),
      ),
  });
  const save = useMutation({
    mutationFn: async (f: FormData) => {
      return featureRpc("bfe_save_office_contact", {
        p_id: editing ? editing.id : client,
        p_version: editing ? editing.version : 0,
        p_group: f.get("group"),
        p_name: f.get("name"),
        p_phone: f.get("phone"),
        p_label: f.get("label"),
        p_active: f.get("active") === "on",
        p_reference: f.get("reference"),
      });
    },
    onSuccess: async () => {
      setEditing(false);
      setClient(crypto.randomUUID());
      setNotice("Contact saved by the server.");
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["office-configuration"] }),
        cache.invalidateQueries({ queryKey: ["published-office-contacts"] }),
      ]);
    },
  });
  return (
    <section className="panel">
      <Feedback error={query.error} message={notice} />
      {query.isPending && <Skeleton />}
      {query.data && editing === false && (
        <>
          {query.data.can_manage && (
            <Button
              onClick={() => {
                setEditing(null);
                setClient(crypto.randomUUID());
                save.reset();
              }}
            >
              Add contact
            </Button>
          )}
          {!query.data.rows.length && (
            <p>
              No Office-managed contacts yet. Existing configured contacts
              remain visible to residents.
            </p>
          )}
          {query.data.rows.map((r) => (
            <article className={styles.record} key={r.id}>
              <strong>{r.name}</strong>
              <p>
                {r.group_name} · {r.label} · {r.active ? "Published" : "Hidden"}
              </p>
              <p>{r.phone}</p>
              {query.data?.can_manage && (
                <Button
                  secondary
                  onClick={() => {
                    setEditing(r);
                    save.reset();
                  }}
                >
                  Edit contact
                </Button>
              )}
            </article>
          ))}
        </>
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
              Group
              <select
                name="group"
                required
                defaultValue={editing ? editing.group_name : ""}
              >
                <option value="">Choose</option>
                {["Emergency", "HOA & security", "Utilities"].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label>
              Contact name
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                defaultValue={editing ? editing.name : ""}
              />
            </label>
            <label>
              Phone number
              <input
                name="phone"
                type="tel"
                required
                minLength={3}
                maxLength={40}
                defaultValue={editing ? editing.phone : ""}
              />
            </label>
            <label>
              Line label
              <input
                name="label"
                maxLength={120}
                defaultValue={editing ? editing.label : ""}
              />
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing ? editing.active : true}
              />
              Publish this contact
            </label>
            <label>
              Official source or approval reference
              <input name="reference" required minLength={3} maxLength={200} />
            </label>
            <Feedback error={save.error} />
            <div className={styles.actions}>
              <Button type="button" secondary onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" pending={save.isPending}>
                Save contact
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
