import { RefreshCw } from "lucide-react";
import { useAuth } from "../../data/auth";
import { Button, ButtonLink } from "../../components/UI";
import DeveloperPage from "./DeveloperPage";
import DeveloperServices from "./DeveloperServices";
import styles from "./DeveloperScreens.module.css";

export default function DeveloperConnections() {
  const auth = useAuth();
  return (
    <DeveloperPage
      title="Connections"
      description="Outside services the portal depends on, and what can currently be verified."
      actions={
        <Button secondary onClick={auth.retry}>
          <RefreshCw size={18} />
          Recheck session
        </Button>
      }
    >
      <p className={styles.result}>4 services</p>
      <DeveloperServices detailed />
      <details className={styles.disclosure}>
        <summary>Additional checks and verification scope</summary>
        <p>
          Private storage, mail delivery, background jobs and hosting deployment
          status are not continuously monitored. Use the existing record
          diagnostics to check the sources exposed by the server.
        </p>
        <p>
          Identity last verified:{" "}
          {auth.verifiedAt
            ? new Date(auth.verifiedAt).toLocaleString("en-PH", {
                timeZone: "Asia/Manila",
              })
            : "Not verified"}
          .
        </p>
        <ButtonLink to="/developer/modules">
          Open operational monitoring
        </ButtonLink>
      </details>
      <div className={styles.toolLinks}>
        <ButtonLink to="/workspaces">Account workspaces</ButtonLink>
        <ButtonLink tone="danger" to="/sign-out">
          Sign out
        </ButtonLink>
      </div>
    </DeveloperPage>
  );
}
