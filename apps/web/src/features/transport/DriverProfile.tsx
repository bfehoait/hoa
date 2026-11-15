import MemberProfile from "../more/MemberProfile";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import { shuttleDashboardSchema } from "../../../../../packages/shared/src/shuttle";
import { Button, Feedback, Skeleton, Badge } from "../../components/UI";
import styles from "./Shuttle.module.css";
export default function DriverProfile() {
  const auth = useAuth();
  const sample = auth.preview || !!auth.rolePreview;
  const query = useQuery({
    queryKey: ["transport-profile-assignment", auth.userId],
    enabled: !!auth.userId && !auth.checking && !sample,
    retry: false,
    queryFn: async () =>
      shuttleDashboardSchema.parse(
        await featureRpc("bfe_shuttle_journey_dashboard", {
          p_history: false,
          p_page: 0,
          p_outcome: "",
        }),
      ),
  });
  const assigned =
    query.data?.shuttles.filter((s) => s.driver_id === auth.userId) ?? [];
  return (
    <MemberProfile
      transport
      assignment={
        <section
          className={styles.driverAssignment}
          aria-label="Office-managed shuttle assignment"
        >
          <h2>Shuttle assignment</h2>
          <p>
            Office assigns your shuttle, passenger limit and service phone
            number. The form below updates only your personal details.
          </p>
          {sample ? (
            <p>
              Sample preview only. Your live shuttle assignment is not shown.
            </p>
          ) : query.isPending ? (
            <Skeleton />
          ) : query.isError ? (
            <>
              <Feedback error={query.error} />
              <Button secondary onClick={() => void query.refetch()}>
                Retry assignment
              </Button>
            </>
          ) : !assigned.length ? (
            <p>
              No shuttle is assigned to your account. Contact Office if you
              should have an assignment.
            </p>
          ) : (
            assigned.map((s) => (
              <dl key={s.code}>
                <div>
                  <dt>Shuttle</dt>
                  <dd>{s.code}</dd>
                </div>
                <div>
                  <dt>Driver name</dt>
                  <dd>{s.driver_name}</dd>
                </div>
                <div>
                  <dt>Capacity</dt>
                  <dd>{s.capacity} passengers</dd>
                </div>
                <div>
                  <dt>Service contact</dt>
                  <dd>{s.contact || "Not supplied"}</dd>
                </div>
                <div>
                  <dt>Duty</dt>
                  <dd>
                    <Badge>{s.on_duty ? "On duty" : "Off duty"}</Badge>
                  </dd>
                </div>
              </dl>
            ))
          )}
        </section>
      }
    />
  );
}
