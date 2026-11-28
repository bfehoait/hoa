import PageIntro from "../office/OfficePage";
import { useId, useState } from "react";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import {
  committeeNames,
  permissionQuestions,
} from "../../../../../packages/shared/src/permissions";
import { usePermissions } from "../../data/permissions";
import { Badge, Button, Feedback, Skeleton } from "../../components/UI";
import styles from "./DeveloperConsole.module.css";
import AccessManager from "./AccessManager";
import TabAccess from "./TabAccess";
import { useLocation, useSearchParams } from "react-router-dom";
import DeveloperPage from "./DeveloperPage";
import CommitteeCatalog from "./CommitteeCatalog";

export default function AccessPlanning({
  memberOnly = false,
}: {
  memberOnly?: boolean;
}) {
  const access = usePermissions();
  const [params, setParams] = useSearchParams();
  const panelId = useId();
  const [defaultsDirty, setDefaultsDirty] = useState(false);
  const [defaultsPending, setDefaultsPending] = useState(false);
  const office = useLocation().pathname.startsWith("/office");
  const manages = !!(
    access.data?.developer_control || access.data?.access_manager
  );
  const tabs = [
    { id: "members", label: "Members" },
    { id: "defaults", label: "Group defaults" },
    { id: "committees", label: "Committees" },
    { id: "reference", label: "Access reference" },
  ];
  const requestedTab = params.get("accessTab");
  const activeTab =
    !manages || access.sample
      ? "reference"
      : params.has("accountSearch")
        ? "members"
        : tabs.some((tab) => tab.id === requestedTab)
          ? requestedTab!
          : "members";
  const tabsLocked = defaultsDirty || defaultsPending;
  if (memberOnly) return <AccessManager overlayOnly />;
  return (
    <>
      {!office ? (
        <DeveloperPage
          title="Access configuration"

          actions={
            <Button secondary onClick={() => void access.refetch()}>
              Refresh access
            </Button>
          }
        />
      ) : (
        <PageIntro
          eyebrow={
            office ||
            (access.data?.access_manager && !access.data.developer_control)
              ? "OFFICE · ACCESS MANAGEMENT"
              : "DEVELOPER · ACCESS MANAGEMENT"
          }
          title="Roles & permissions"

          icon={<ShieldCheck size={28} />}
          action={
            <Button secondary onClick={() => void access.refetch()}>
              Refresh access
            </Button>
          }
        />
      )}
      {!access.sample && manages && (
        <>
          <div
            role="tablist"
            aria-label="Access configuration sections"
            className={styles.accessTabs}
            onKeyDown={(event) => {
              const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
              if (!keys.includes(event.key)) return;
              const buttons = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]:not(:disabled)',
                ),
              );
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              if (index < 0) return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        buttons.length) %
                      buttons.length;
              buttons[next]?.focus();
              buttons[next]?.click();
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`${panelId}-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`${panelId}-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                disabled={tabsLocked && activeTab !== tab.id}
                onClick={() => {
                  if (tabsLocked || activeTab === tab.id) return;
                  const next = new URLSearchParams(params);
                  next.set("accessTab", tab.id);
                  next.delete("accountSearch");
                  setParams(next, { replace: true, preventScrollReset: true });
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {tabsLocked && (
            <p className="note" role="status">
              Save or discard group-default changes before switching tabs.
            </p>
          )}
          <section
            role="tabpanel"
            id={`${panelId}-panel-committees`}
            aria-labelledby={`${panelId}-tab-committees`}
            hidden={activeTab !== "committees"}
            className={styles.accessPanel}
            tabIndex={0}
          >
            <CommitteeCatalog />
          </section>
        </>
      )}
      {!access.sample &&
        (access.data?.developer_control || access.data?.access_manager) && (
          <>
            <section
              role="tabpanel"
              id={`${panelId}-panel-members`}
              aria-labelledby={`${panelId}-tab-members`}
              hidden={activeTab !== "members"}
              className={styles.accessPanel}
              tabIndex={0}
            >
              <AccessManager />
            </section>
            <section
              role="tabpanel"
              id={`${panelId}-panel-defaults`}
              aria-labelledby={`${panelId}-tab-defaults`}
              hidden={activeTab !== "defaults"}
              className={styles.accessPanel}
              tabIndex={0}
            >
              <TabAccess
                onDirtyChange={setDefaultsDirty}
                onPendingChange={setDefaultsPending}
              />
            </section>
          </>
        )}
      <section
        {...{
          hidden: activeTab !== "reference",
          role: manages && !access.sample ? "tabpanel" : undefined,
          id: `${panelId}-panel-reference`,
          "aria-labelledby":
            manages && !access.sample ? `${panelId}-tab-reference` : undefined,
          tabIndex: 0,
          className: styles.accessPanel,
        }}
      >
        <h2>Your effective access</h2>
        {access.sample ? (
          <p className="note">
            Synthetic preview. Real account permissions are not loaded here.
          </p>
        ) : access.isPending ? (
          <Skeleton />
        ) : access.isError ? (
          <Feedback error={access.error} />
        ) : access.data?.developer_control ? (
          <section className={styles.card}>
            <ShieldCheck size={28} />
            <h3>Developer control</h3>
            <p>
              Account roles/status, staff permissions and the implemented
              request workflow. Other business workflows still need their
              protected backend operations.
            </p>
          </section>
        ) : (
          <div className={styles.grid}>
            {access.data?.capabilities.map((item) => (
              <section
                className={styles.card}
                key={`${item.module}:${item.action}:${item.scope}`}
              >
                <ShieldCheck size={24} />
                <h3>{item.module}</h3>
                <p>
                  {item.action} · {item.scope}
                </p>
              </section>
            ))}
          </div>
        )}
        <h2>Committee scopes</h2>
        <div className={styles.grid}>
          {committeeNames.map((name) => (
            <section className={styles.card} key={name}>
              <ClipboardCheck size={24} />
              <h3>{name}</h3>
              <Badge>Actions need approval</Badge>
            </section>
          ))}
        </div>
        <h2>Decisions still open</h2>
        <ul>
          {permissionQuestions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
