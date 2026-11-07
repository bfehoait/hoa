import { useAuth } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import { canOpenPath } from "../../../../../packages/shared/src/auth";
import { useAccountNavigation } from "../../components/AccountNavigation";
import { useState } from "react";
import {
  CalendarDays,
  Building2,
  CarFront,
  CircleHelp,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Search,
  Settings2,
  ShoppingBag,
  UserRound,
  Users,
  Vote,
  Bell,
  Flag,
  Wrench,
} from "lucide-react";
import {
  DestinationGrid,
  DetailDisclosure,
  type Destination,
} from "../../components/Navigation";
import { ButtonLink, Empty, PageIntro } from "../../components/UI";
import styles from "./MoreHub.module.css";

const groups: { title: string; category: string; items: Destination[] }[] = [
  {
    title: "Your home",
    category: "Home",
    items: [
      {
        to: "/more/lots",
        title: "Your lots",
        detail: "Verified property links and receipts",
        icon: Building2,
      },
      {
        to: "/more/vehicles",
        title: "Vehicles & stickers",
        detail: "Registration requests",
        icon: CarFront,
      },
      {
        to: "/more/permits",
        title: "Permits & clearances",
        detail: "Property work & documents",
        icon: ClipboardCheck,
      },
      {
        to: "/more/documents",
        title: "Community documents",
        detail: "Read published records",
        icon: FileText,
      },
      {
        to: "/services/calendar",
        title: "Calendar",
        detail: "Dates & local requests",
        icon: CalendarDays,
      },
    ],
  },
  {
    title: "Raise it with the office",
    category: "Raise",
    items: [
      {
        to: "/services/requests?new=Complaint",
        title: "File a complaint",
        detail: "A private matter involving a neighbour",
        icon: Flag,
      },
      {
        to: "/services/requests?new=Concern",
        title: "Raise a concern",
        detail: "For the office, board or officers to review",
        icon: MessageSquare,
      },
      {
        to: "/services/requests?new=Maintenance",
        title: "Report an issue",
        detail: "Damage or maintenance in the community",
        icon: Wrench,
      },
      {
        to: "/services/requests",
        title: "Your requests",
        detail: "Follow everything you have raised",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    title: "Livelihood & marketplace",
    category: "Community",
    items: [
      {
        to: "/directory/market",
        title: "Marketplace",
        detail: "Businesses, jobs & nearby finds",
        icon: ShoppingBag,
      },
      {
        to: "/directory/learning",
        title: "Training & workshops",
        detail: "Browse upcoming sessions",
        icon: GraduationCap,
      },
      {
        to: "/more/transport",
        title: "Shuttle",
        detail: "Authorized vehicles & today’s requests",
        icon: CarFront,
      },
      {
        to: "/directory/transport",
        title: "Carpooling",
        detail: "Share a ride with neighbours",
        icon: Users,
      },
      {
        to: "/more/elections",
        title: "Community elections",
        detail: "Readiness & information",
        icon: Vote,
      },
    ],
  },
  {
    title: "Your account & support",
    category: "Account",
    items: [
      {
        to: "/more/profile",
        title: "My profile",
        detail: "Your account & contact details",
        icon: UserRound,
      },
      {
        to: "/services/inbox",
        title: "Messages",
        detail: "Your office conversations",
        icon: MessageSquare,
      },
      {
        to: "/more/notifications",
        title: "Notifications",
        detail: "New and earlier activity",
        icon: Bell,
      },
      {
        to: "/more/help",
        title: "Help & support",
        detail: "Answers & preview guidance",
        icon: CircleHelp,
      },
      {
        to: "/more/settings",
        title: "Settings",
        detail: "Account and appearance",
        icon: Settings2,
      },
    ],
  },
];
const tools: Destination[] = [
  {
    to: "/office",
    title: "Office & reports",
    detail: "Office queues and reports",
    icon: LayoutDashboard,
  },
  {
    to: "/explore",
    title: "Service directory",
    detail: "Forms, submissions and community services",
    icon: LayoutGrid,
  },
  {
    to: "/coverage",
    title: "Source coverage",
    detail: "All 16 source areas & gates",
    icon: ClipboardCheck,
  },
  {
    to: "/developer",
    title: "Developer maintenance",
    detail: "Diagnostics & local reset",
    icon: Settings2,
  },
  {
    to: "/sign-in",
    title: "Switch preview workspace",
    detail: "Resident, office, security & more",
    icon: UserRound,
  },
];
export default function MoreHub() {
  const auth = useAuth();
  const permissions = usePermissions();
  const accessGroups = useAccountNavigation().filter(
    (area) => area.id !== "resident",
  );
  const allowed = (item: Destination) =>
    auth.preview ||
    (!!auth.member &&
      canOpenPath(auth.member, item.to) &&
      permissions.allowsPath(item.to));
  const availableGroups = groups
    .map((group) => ({ ...group, items: group.items.filter(allowed) }))
    .filter((group) => group.items.length);

  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("All");
  const match = (item: Destination) =>
    `${item.title} ${item.detail}`.toLowerCase().includes(search.toLowerCase());
  const visible = availableGroups
    .filter((group) => category === "All" || group.category === category)
    .map((group) => ({ ...group, items: group.items.filter(match) }))
    .filter((group) => group.items.length);
  const matches = tools.filter(
    (item) =>
      (auth.preview || !!auth.rolePreview) && allowed(item) && match(item),
  );
  return (
    <>
      <PageIntro
        eyebrow="FIND YOUR WAY AROUND"
        title="More"
        description="Home, community and account essentials."
      />
      <div className="search">
        <Search size={20} aria-hidden="true" />
        <input
          aria-label="Find a feature"
          placeholder="Search features…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCategory("All");
          }}
        />
      </div>
      <div
        className={styles.categories}
        role="group"
        aria-label="Feature categories"
      >
        {["All", ...availableGroups.map((group) => group.category)].map(
          (value) => (
            <button
              type="button"
              key={value}
              className="filter"
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
            >
              {value}
            </button>
          ),
        )}
      </div>
      {category === "All" &&
        accessGroups.map((area) => {
          const items = area.links
            .map((link) => ({
              to: link.to,
              title: `${area.title}: ${link.label}`,
              icon: link.icon,
            }))
            .filter(match);
          return items.length ? (
            <DetailDisclosure key={area.id} title={area.title}>
              <DestinationGrid items={items} compact />
            </DetailDisclosure>
          ) : null;
        })}
      {visible.map((group) => (
        <section key={group.category} className={styles.group}>
          <h2>{group.title}</h2>
          <DestinationGrid
            items={group.items}
            compact={group.category === "Account"}
          />
        </section>
      ))}
      {!visible.length &&
        !matches.length &&
        !accessGroups.some((area) =>
          area.links.some((link) =>
            `${area.title}: ${link.label}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          ),
        ) && (
          <Empty title="No matching feature.">
            Try another word or choose a different category.
          </Empty>
        )}
      {!search && matches.length > 0 && (
        <DetailDisclosure
          title={
            auth.preview || auth.rolePreview
              ? "Preview & maintenance tools"
              : "Tools & administration"
          }
        >
          <p>
            {auth.preview || auth.rolePreview
              ? "These tools demonstrate workflows and local maintenance. Opening a workspace does not grant permissions or authenticate anyone."
              : "Open the tools available to your account. Services that are not connected are marked as unavailable."}
          </p>
          <div className={styles.tools}>
            <DestinationGrid items={matches} compact />
          </div>
        </DetailDisclosure>
      )}
      {search && matches.length > 0 && (
        <section className={styles.group}>
          <h2>Matching tools</h2>
          <DestinationGrid items={matches} compact />
        </section>
      )}
      {!auth.rolePreview && (
        <div className={styles.exit}>
          <ButtonLink tone="danger" to="/sign-out">
            <LogOut size={20} aria-hidden="true" />
            {auth.preview ? "Leave preview" : "Sign out"}
          </ButtonLink>
          <p>
            {auth.preview
              ? "Returns to the preview entry screen."
              : "Securely end your account session."}
          </p>
        </div>
      )}
    </>
  );
}
