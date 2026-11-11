import { useSearchParams } from "react-router-dom";
import { Button } from "../../components/UI";
import { useAuth } from "../../data/auth";
import LiveFeature from "../connected/LiveFeature";
import ParticipationDesk from "../connected/ParticipationDesk";
import CarpoolDemo from "./CarpoolDemo";
import styles from "../connected/LiveFeature.module.css";

/** Real records and the visual map demo have separate, labelled destinations. */
export default function CarpoolHub() {
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = ["rides", "mine", "interests", "demo"].includes(
    params.get("tab") ?? "",
  )
    ? params.get("tab")!
    : "rides";
  if (auth.preview || auth.rolePreview) return <CarpoolDemo />;
  return (
    <>
      <div
        className={styles.actions}
        role="group"
        aria-label="Carpool sections"
      >
        {(
          [
            ["rides", "Community rides"],
            ["mine", "My offers & requests"],
            ["interests", "My ride interests"],
            ["demo", "Map demo"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            secondary={tab !== id}
            aria-pressed={tab === id}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("tab", id);
              setParams(next);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === "demo" ? (
        <CarpoolDemo />
      ) : tab === "interests" ? (
        <ParticipationDesk module="carpools" />
      ) : (
        <LiveFeature
          key={tab}
          module="carpools"
          initialView={tab === "mine" ? "mine" : "published"}
          resident
        />
      )}
    </>
  );
}
