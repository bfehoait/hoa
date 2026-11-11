import { Phone, ShieldCheck, Droplets } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import { Feedback, PageIntro } from "../../components/UI";
import styles from "./Hotlines.module.css";
import {
  emergencyContacts,
  communityContacts,
  utilityContacts,
  hotlineTelephone,
} from "./hotline-contacts";

const groups = [
  {
    title: "Emergency",
    icon: Phone,
    contacts: emergencyContacts,
  },
  {
    title: "HOA & security",
    icon: ShieldCheck,
    contacts: communityContacts,
  },
  {
    title: "Utilities",
    icon: Droplets,
    contacts: utilityContacts,
  },
];

export default function Hotlines() {
  const auth = useAuth();
  const updates = useQuery({
    queryKey: ["published-office-contacts", auth.userId],
    enabled:
      !!auth.userId &&
      !auth.preview &&
      !auth.rolePreview &&
      !auth.memberPreview,
    retry: false,
    gcTime: 0,
    refetchInterval: 60000,
    queryFn: async () =>
      z
        .array(
          z.object({
            id: z.uuid(),
            group: z.string(),
            name: z.string(),
            phone: z.string(),
            label: z.string(),
            active: z.boolean(),
          }),
        )
        .parse(await featureRpc("bfe_published_office_contacts", {})),
  });
  const displayedGroups = groups.map((group) => {
    const managed = (updates.data ?? []).filter(
      (row) => row.group === group.title,
    );
    const managedNames = new Set(
      managed.map((row) => row.name.trim().toLowerCase()),
    );
    const contacts = group.contacts.filter(
      (row) => !managedNames.has(row.name.trim().toLowerCase()),
    );
    const combined = new Map<
      string,
      { name: string; lines: { number: string; label: string }[] }
    >();
    for (const row of managed.filter((row) => row.active)) {
      const key = row.name.trim().toLowerCase();
      const contact = combined.get(key) ?? { name: row.name, lines: [] };
      contact.lines.push({ number: row.phone, label: row.label });
      combined.set(key, contact);
    }
    return { ...group, contacts: [...contacts, ...combined.values()] };
  });
  return (
    <div className={styles.page}>
      <PageIntro
        title="Hotlines"
        description="Emergency, community and utility contacts."
      />
      <a
        className={styles.emergencyCall}
        href="tel:161"
        aria-label="Call Bacoor Rescue 161"
      >
        <Phone size={28} aria-hidden="true" />
        <span>
          <strong>Call Rescue 161</strong>
          <span>Bacoor emergency hotline</span>
        </span>
      </a>
      <p className={styles.notice} role="note">
        Tap Call to open your device’s dialer. The local 161 short code may
        depend on your phone network.
      </p>
      {updates.isError && (
        <Feedback
          error={
            new Error(
              "Office-managed contact updates could not be loaded. Existing configured contacts are shown below.",
            )
          }
        />
      )}
      <div className={styles.groups}>
        {displayedGroups.map(({ title, icon: Icon, contacts }, index) => (
          <section
            key={title}
            className={`${styles.group} ${index === 0 ? styles.emergencyGroup : ""}`}
          >
            <h2>
              <Icon size={20} aria-hidden="true" />
              {title}
            </h2>
            <ul>
              {contacts.map(({ name, lines }) => (
                <li key={name}>
                  <div>
                    <h3>{name}</h3>
                    <div className={styles.lines}>
                      {lines.map(({ number, label }) => (
                        <div className={styles.line} key={number}>
                          <div>
                            {label && <p>{label}</p>}
                            <span className={styles.number}>{number}</span>
                          </div>
                          <a
                            className={styles.call}
                            href={hotlineTelephone(number)}
                            aria-label={`Call ${name}${label ? ", " + label : ""}, ${number}`}
                          >
                            <Phone size={18} aria-hidden="true" />
                            Call
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
