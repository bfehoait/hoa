import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  UsersRound,
  TriangleAlert,
  ArrowRight,
} from "lucide-react";
import { visitorDashboardSchema } from "../../../../../packages/shared/src/operations";
import { useAuth } from "../../data/auth";
import { featureRpc, useFeatureRecords } from "../../data/feature-records";
import { Button, Feedback, Skeleton } from "../../components/UI";
import { Link } from "../../components/AccessLink";
import OfficePage from "../office/OfficePage";
import styles from "./Board.module.css";
import { useWorkspaceMetrics } from "../../data/workspace-metrics";

export default function SecurityOverview() {
  const auth = useAuth();
  const metrics = useWorkspaceMetrics("security");
  const sample = auth.preview || !!auth.rolePreview;
  const passes = useQuery({
    queryKey: ["security-overview-passes", auth.userId],
    enabled: !!auth.userId && !auth.checking && !sample,
    retry: false,
    refetchInterval: 30000,
    queryFn: async () =>
      visitorDashboardSchema.parse(
        await featureRpc("bfe_community_pass_dashboard", {
          p_office: true,
          p_page: 0,
        }),
      ),
  });
  const incidents = useFeatureRecords("incidents", "mine", 0, "");
  const expected =
    passes.data?.rows.filter((r) => r.effective_status === "Approved") ?? [];
  return (
    <>
      <OfficePage
        title="Overview"
        description="Check visitor passes, registered vehicles and incidents you reported."
      />
      <section className={styles.section}>
        <h2>Gate activity</h2>
        <div className={styles.grid}>
          {[
            {
              title: "Passes marked Entered",
              value: metrics.data?.entered_passes,
              note: "Passes marked as entered and not yet marked as exited. This is not a confirmed headcount inside the estate.",
            },
            {
              title: "Gate entries and exits today",
              value: metrics.data?.movements_today,
              note: "Entries and exits recorded today, using Philippine time. Movements that were not recorded are not included.",
            },
            {
              title: "Entries recorded today",
              value: metrics.data?.entries_by_type?.reduce(
                (sum, r) => sum + r.count,
                0,
              ),
              note:
                metrics.data?.entries_by_type
                  ?.map((r) => `${r.label.replaceAll("_", " ")}: ${r.count}`)
                  .join(" · ") ||
                "Recorded entries grouped by pass type. Resident movements without a recorded pass are not included.",
            },
          ].map((m) => (
            <article className={styles.card} key={m.title}>
              <h3>{m.title}</h3>
              <span className={styles.icon}>
                <ShieldCheck size={24} />
              </span>
              <strong
                className={
                  m.value === undefined ? styles.unavailable : styles.value
                }
              >
                {m.value ??
                  (metrics.isFetching ? (
                    <Skeleton variant="metric" label="Loading gate activity" />
                  ) : (
                    "Unavailable"
                  ))}
              </strong>
              <p>{m.note}</p>
            </article>
          ))}
        </div>
        {metrics.isError && <Feedback error={metrics.error} />}
        {metrics.data?.as_of && (
          <p className="note">
            As of{" "}
            {new Date(metrics.data.as_of).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
            })}{" "}
            · Philippine time
          </p>
        )}
      </section>
      <section className={styles.section}>
        <h2>Passes & incidents</h2>
        <div className={styles.grid}>
          <article className={styles.card}>
            <h3>Approved passes</h3>
            <p>
              A short list of approved passes. Open Visitors to see more; this
              is not the full expected-arrival count.
            </p>
            {sample ? (
              <p>Sample preview only. Live passes are not shown.</p>
            ) : passes.isPending ? (
              <Skeleton />
            ) : passes.isError ? (
              <>
                <Feedback error={passes.error} />
                <Button secondary onClick={() => void passes.refetch()}>
                  Retry passes
                </Button>
              </>
            ) : expected.length ? (
              expected.slice(0, 4).map((r) => (
                <div key={r.id}>
                  <strong>{r.visitor}</strong>
                  <p>
                    Lot {r.physical_id} ·{" "}
                    {new Date(r.valid_from).toLocaleString("en-PH", {
                      timeZone: "Asia/Manila",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))
            ) : (
              <p>No approved passes to show here.</p>
            )}
            <Link to="/security/visitors">
              <UsersRound size={18} /> Open visitors <ArrowRight size={18} />
            </Link>
          </article>
          <article className={styles.card}>
            <h3>Incidents you reported</h3>
            <p>
              Reports sent from your account. Reports from other guards are not
              included.
            </p>
            {sample ? (
              <p>Sample preview only. Live incident reports are not shown.</p>
            ) : incidents.isPending ? (
              <Skeleton />
            ) : incidents.isError ? (
              <>
                <Feedback error={incidents.error} />
                <Button secondary onClick={() => void incidents.refetch()}>
                  Retry incidents
                </Button>
              </>
            ) : incidents.data?.rows.length ? (
              incidents.data.rows.slice(0, 4).map((r) => (
                <div key={r.id}>
                  <strong>{r.title}</strong>
                  <p>{r.status}</p>
                </div>
              ))
            ) : (
              <p>You have no incident reports to show.</p>
            )}
            <Link to="/security/incidents">
              <TriangleAlert size={18} /> Open incidents{" "}
              <ArrowRight size={18} />
            </Link>
          </article>
        </div>
      </section>
    </>
  );
}
