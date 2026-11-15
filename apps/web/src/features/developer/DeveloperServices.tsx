import { useState } from "react";
import { Cable, Bus, Banknote, ArrowRight } from "lucide-react";
import { useAuth } from "../../data/auth";
import { Button, ButtonLink, Badge, Modal } from "../../components/UI";
import styles from "./DeveloperScreens.module.css";

export default function DeveloperServices({
  detailed = false,
}: {
  detailed?: boolean;
}) {
  const auth = useAuth();
  const [selected, setSelected] = useState<number | null>(null);
  const verified =
    !auth.preview &&
    !auth.rolePreview &&
    !!auth.verifiedAt &&
    !!auth.member &&
    !auth.memberError &&
    !auth.identityError;
  const services = [
    {
      title: "Supabase",
      icon: Cable,
      description: "Database, authentication & permissions",
      status: verified ? "Session verified" : "Not verified",
      live: verified,
      note: "This verifies the current signed-in identity and member lookup. It does not certify all database policies, Storage, background jobs or server health.",
      to: "/developer/modules/people",
      action: "Open account diagnostics",
    },
    {
      title: "Vercel",
      icon: Cable,
      description: "Web hosting & deployments",
      status: "Not monitored",
      live: false,
      note: "This app does not have deployment-health or release-status telemetry. Loading this page is not a health check of Vercel. Review your hosting dashboard independently.",
      to: "/developer/modules",
      action: "Open portal diagnostics",
    },
    {
      title: "Buyani",
      icon: Banknote,
      description: "Dues payment provider",
      status: "Not monitored",
      live: false,
      note: "The configured payment handoff is available from the household account. Reachability, settlement and bank clearance are not monitored by this console.",
      to: "/workspaces",
      action: "Open account workspaces",
    },
    {
      title: "OSRM / OpenStreetMap",
      icon: Bus,
      description: "Shuttle maps & route geometry",
      status: "Not monitored",
      live: false,
      note: "Map and route requests are made by the transport screen. No continuous provider-health check, live vehicle tracking or ETA is available here.",
      to: "/developer/modules/transport",
      action: "Open transport diagnostics",
    },
  ];
  const current = selected === null ? null : services[selected];
  return (
    <>
      <div className={styles.grid}>
        {services.map((service, index) => (
          <article className={styles.card} key={service.title}>
            <h3>
              <span className={styles.icon}>
                <service.icon size={21} aria-hidden="true" />
              </span>
              {service.title}
            </h3>
            {detailed && <p>{service.description}</p>}
            <div className={styles.cardFooter}>
              <span className={styles.status}>
                <i data-live={service.live || undefined} />
                {service.status}
              </span>
              {detailed && (
                <Button secondary size="sm" onClick={() => setSelected(index)}>
                  Open<span className="sr-only"> {service.title} details</span>
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      {current && (
        <Modal title={current.title} onClose={() => setSelected(null)}>
          <Badge tone={current.live ? "green" : "neutral"}>
            {current.status}
          </Badge>
          <p className={styles.modalNote}>{current.note}</p>
          <div className="form-actions">
            <ButtonLink to={current.to}>
              {current.action}
              <ArrowRight size={18} aria-hidden="true" />
            </ButtonLink>
            <Button secondary onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
