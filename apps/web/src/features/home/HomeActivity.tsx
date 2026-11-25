import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CarFront,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../data/auth";
import { useRequests } from "../../data/requests";
import { featureRpc } from "../../data/feature-records";
import { bookingDashboardSchema } from "../../../../../packages/shared/src/operations";
import { featureDashboardSchema } from "../../../../../packages/shared/src/feature-records";
import { Link } from "../../components/AccessLink";
import { Badge, Button, Skeleton } from "../../components/UI";
import styles from "./HomeActivity.module.css";

function date(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function HomeRequests() {
  const query = useRequests(false, 0, "", "");
  return (
    <section className={styles.panel} aria-labelledby="home-requests">
      <div className={styles.heading}>
        <h2 id="home-requests">
          <MessageSquare size={20} aria-hidden="true" />
          Request updates
        </h2>
        <Link to="/services/requests" aria-label="View all requests">
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      </div>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <div className={styles.empty}>
          <p>Request updates couldn’t be loaded.</p>
          <Button secondary onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : query.data.records.length ? (
        <ul className={styles.records}>
          {query.data.records.slice(0, 2).map((row) => (
            <li key={row.id}>
              <Link to="/services/requests">
                <strong>{row.title}</strong>
                <span className={styles.meta}>
                  <Badge>{row.status}</Badge>
                  <time dateTime={row.updated_at}>{date(row.updated_at)}</time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <p>No requests yet</p>
          <span>Follow office replies and progress here.</span>
          <Link to="/services/requests">
            Open Helpdesk <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}

export function HomeBookings() {
  const auth = useAuth();
  const query = useQuery({
    queryKey: ["home-bookings", auth.userId],
    enabled:
      !!auth.userId && !auth.checking && !auth.preview && !auth.rolePreview,
    gcTime: 300_000,
    staleTime: 10000,
    retry: false,
    refetchInterval: 30000,
    queryFn: async () =>
      bookingDashboardSchema.parse(
        await featureRpc("bfe_booking_dashboard", {
          p_office: false,
          p_page: 0,
        }),
      ),
  });
  return (
    <section className={styles.panel} aria-labelledby="home-bookings">
      <div className={styles.heading}>
        <h2 id="home-bookings">
          <CalendarDays size={20} aria-hidden="true" />
          Recent bookings
        </h2>
        <Link to="/services/bookings" aria-label="View amenity bookings">
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      </div>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <div className={styles.empty}>
          <p>Booking updates couldn’t be loaded.</p>
          <Button secondary onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : query.data.rows.length ? (
        <ul className={styles.records}>
          {query.data.rows.slice(0, 2).map((row) => (
            <li key={row.id}>
              <Link to="/services/bookings">
                <strong>{row.facility_name}</strong>
                <span className={styles.meta}>
                  <Badge>{row.status}</Badge>
                  <time dateTime={row.starts_at}>{date(row.starts_at)}</time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <p>Make time for your community</p>
          <span>Your amenity bookings will appear here.</span>
          <Link to="/services/bookings">
            Explore amenities <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}

// Owner request, 25 November 2026: homeowners see carpools as soon as a
// neighbour posts one (published on submission by migration 096).
export function HomeCarpools() {
  const auth = useAuth();
  const query = useQuery({
    queryKey: ["home-carpools", auth.userId],
    enabled:
      !!auth.userId && !auth.checking && !auth.preview && !auth.rolePreview,
    gcTime: 300_000,
    staleTime: 10000,
    retry: false,
    refetchInterval: 60000,
    queryFn: async () =>
      featureDashboardSchema.parse(
        await featureRpc("bfe_feature_dashboard", {
          p_module: "carpools",
          p_view: "published",
          p_page: 0,
          p_search: "",
        }),
      ),
  });
  return (
    <section className={styles.panel} aria-labelledby="home-carpools">
      <div className={styles.heading}>
        <h2 id="home-carpools">
          <CarFront size={20} aria-hidden="true" />
          New carpools
        </h2>
        <Link to="/directory/transport" aria-label="View all carpools">
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      </div>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <div className={styles.empty}>
          <p>Carpools couldn’t be loaded.</p>
          <Button secondary onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : query.data.rows.length ? (
        <ul className={styles.records}>
          {query.data.rows.slice(0, 3).map((row) => (
            <li key={row.id}>
              <Link to="/directory/transport">
                <strong>{row.title}</strong>
                <span className={styles.meta}>
                  <Badge tone="green">Available</Badge>
                  {row.expires_at && (
                    <time dateTime={row.expires_at}>
                      Until {date(row.expires_at)}
                    </time>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <p>No carpools right now</p>
          <span>Rides your neighbours offer will appear here.</span>
          <Link to="/directory/transport?tab=mine">
            Offer a ride <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
