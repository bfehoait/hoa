import {
  UserRound,
  MapPin,
  Flame,
  Phone,
  Mail,
  ShieldCheck,
  Siren,
  ChevronRight,
} from "lucide-react";
import { Link } from "../../components/AccessLink";
import {
  emergencyContacts,
  communityContacts,
  utilityContacts,
  hotlineTelephone,
  type HotlineContact,
} from "../more/hotline-contacts";
import styles from "./HomeHotlines.module.css";
import { adminOfficeContacts } from "./admin-office-contacts";

const contacts = [
  ...emergencyContacts,
  ...communityContacts,
  ...utilityContacts,
];
const groups = [
  {
    title: "BEHOAINC Admin Office",
    names: ["Breighton Land admin office"],
    icon: UserRound,
    tone: "admin",
  },
  {
    title: "Security & Aqualink",
    names: ["BEHOAI security guards", "Aqualink water"],
    icon: ShieldCheck,
    tone: "community",
  },
  {
    title: "Brgy. Molino IV Hotlines",
    names: ["Barangay Molino IV"],
    icon: MapPin,
    tone: "barangay",
  },
  {
    title: "Bacoor Emergency, Cavite Command & PNP",
    names: [
      "Bacoor emergency / Rescue 161",
      "Cavite Command Center",
      "PNP Cavite",
    ],
    icon: Siren,
    tone: "emergency",
  },
  {
    title: "Bureau of Fire & Metro South Medical",
    names: ["Bureau of Fire Cavite", "Metro South Medical Center"],
    icon: Flame,
    tone: "fire",
  },
].map((group) => ({
  ...group,
  contacts: group.names.flatMap((name) =>
    contacts.filter((contact) => contact.name === name),
  ),
}));

function contactRows(lines: HotlineContact["lines"]) {
  const rows: HotlineContact["lines"][] = [];
  for (const line of lines) {
    const previous = rows.at(-1);
    const last = previous?.at(-1);
    const sameLabel = !!line.label && last?.label === line.label;
    const landlines =
      !line.label &&
      !last?.label &&
      line.number.startsWith("(") &&
      previous?.every(({ number }) => number.startsWith("("));
    const shortCodeWithLandline =
      !!last && /^\d{3}$/.test(last.number) && line.number.startsWith("(");
    if (previous && (sameLabel || landlines || shortCodeWithLandline))
      previous.push(line);
    else rows.push([line]);
  }
  return rows;
}

function AdminOfficeContacts() {
  const phoneLines =
    communityContacts.find(
      (contact) => contact.name === "Breighton Land admin office",
    )?.lines ?? [];
  return (
    <>
      {adminOfficeContacts.map((person) => (
        <section
          className={styles.contact}
          key={person.name}
          aria-label={person.name}
        >
          <h4 className={styles.staffName}>{person.name}</h4>
          {person.showOfficePhone &&
            phoneLines.map(({ number }) => (
              <div className={styles.phoneRow} key={number}>
                <Phone size={16} aria-hidden="true" />
                <a
                  href={hotlineTelephone(number)}
                  aria-label={`Call ${person.name}: ${number}`}
                >
                  <strong>{number}</strong>
                </a>
              </div>
            ))}
          <ul>
            {person.emails.map((email) => (
              <li key={email}>
                <a className={styles.emailLink} href={`mailto:${email}`}>
                  <Mail size={16} aria-hidden="true" />
                  <span>{email}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export default function HomeHotlines() {
  return (
    <section className={styles.section} aria-labelledby="home-hotlines-title">
      <div className={styles.heading}>
        <h2 id="home-hotlines-title">Emergency hotlines</h2>
        <Link to="/more/hotlines">
          See all hotlines <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div
        className={styles.carousel}
        role="region"
        aria-label="Hotline categories"
        tabIndex={0}
      >
        {groups.map(({ title, contacts, icon: Icon, tone }) => (
          <article
            className={styles.card}
            key={title}
            aria-label={`${title} contacts`}
          >
            <h3 className={`${styles.category} ${styles[tone]}`}>
              <Icon size={20} aria-hidden="true" />
              {title}
            </h3>
            <div className={styles.contacts}>
              {tone === "admin" ? (
                <AdminOfficeContacts />
              ) : (
                contacts.map((contact) => (
                  <section
                    className={styles.contact}
                    key={contact.name}
                    aria-label={contact.name}
                  >
                    {(contacts.length > 1 || tone === "admin") && (
                      <h4>{contact.name}</h4>
                    )}
                    <ul>
                      {contactRows(contact.lines).map((numbers) => {
                        const sharedLabel =
                          numbers.length > 1 &&
                          numbers[0].label &&
                          numbers.every(
                            (line) => line.label === numbers[0].label,
                          )
                            ? numbers[0].label
                            : undefined;
                        const paired =
                          numbers.length > 1 &&
                          numbers.every(
                            (line) => line.label === numbers[0].label,
                          );
                        return (
                          <li
                            key={numbers.map(({ number }) => number).join(":")}
                          >
                            {sharedLabel && (
                              <span className={styles.lineLabel}>
                                {sharedLabel}
                              </span>
                            )}
                            <div className={styles.phoneRow}>
                              <Phone size={16} aria-hidden="true" />
                              <div
                                className={styles.numbers}
                                data-paired={paired || undefined}
                              >
                                {numbers.map(({ number, label }) => (
                                  <a
                                    key={number}
                                    href={hotlineTelephone(number)}
                                    aria-label={`Call ${contact.name}${label ? `, ${label}` : ""}: ${number}`}
                                  >
                                    {label && !sharedLabel && (
                                      <span className={styles.lineLabel}>
                                        {label}
                                      </span>
                                    )}
                                    <strong>{number}</strong>
                                  </a>
                                ))}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
