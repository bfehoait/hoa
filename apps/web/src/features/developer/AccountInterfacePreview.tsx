import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { AccountPreviewIdentity, makeRealClient } from "../../data/auth";
import { memberSchema } from "../../../../../packages/shared/src/auth";
import { accountPreview } from "../../data/account-preview-client";
import { Button, Feedback, Skeleton } from "../../components/UI";
import styles from "./DeveloperConsole.module.css";
import { z } from "zod";
import { useLocation } from "react-router-dom";
export default function AccountInterfacePreview({
  children,
}: {
  children: ReactNode;
}) {
  const location = useLocation();
  const host = useRef<HTMLDivElement>(null),
    banner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      if (banner.current)
        host.current?.style.setProperty(
          "--preview-banner-offset",
          banner.current.getBoundingClientRect().height + "px",
        );
    };
    const observer = new ResizeObserver(update);
    if (banner.current) observer.observe(banner.current);
    update();
    return () => observer.disconnect();
  }, []);
  const [cache] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      }),
  );
  const [clock, setClock] = useState(() => Date.now()),
    [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["account-interface-member", accountPreview?.id],
    retry: false,
    gcTime: 0,
    refetchInterval: 15000,
    queryFn: async () => {
      const api = makeRealClient();
      if (!api || !accountPreview)
        throw new Error("Sign in with your developer account first.");
      const { data, error } = await api.rpc("bfe_account_preview_read", {
        p_session: accountPreview.id,
        p_name: "bfe_get_member",
        p_args: {},
      });
      if (error)
        throw new Error(
          "Account preview is unavailable, expired, or no longer authorized. Exit and open the member again.",
        );
      const info = z
        .object({
          _preview_expires_at: z.string(),
          _preview_server_now: z.string(),
        })
        .parse(data);
      return {
        member: memberSchema.parse(data),
        deadline:
          Date.now() +
          new Date(info._preview_expires_at).getTime() -
          new Date(info._preview_server_now).getTime(),
      };
    },
  });
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  // Database expiry/revocation is authoritative; refresh identity while the view is open.
  const denied =
    query.isError ||
    !query.data ||
    query.data.member.status !== "Active" ||
    clock >= query.data.deadline;
  async function exit() {
    const api = makeRealClient();
    try {
      await api?.rpc("bfe_end_member_inspection", { p_id: accountPreview?.id });
    } finally {
      cache.clear();
      window.location.assign("/developer/members");
    }
  }
  return (
    <div ref={host} className={styles.previewSession} data-account-preview>
      <div
        className={styles.previewBanner}
        ref={banner}
        role="region"
        aria-label="Account preview"
      >
        <div>
          <strong>
            Preview: {query.data?.member.name ?? "Loading member…"}
          </strong>
          <span>Read-only · No member notification</span>
        </div>
        <Button
          secondary
          aria-label="Exit account preview"
          onClick={() => void exit()}
        >
          Exit preview
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
      <Feedback error={query.error} />
      {query.isPending ? (
        <Skeleton />
      ) : denied ? (
        <p>
          This preview is closed. Use Exit account preview to return to your
          developer account.
        </p>
      ) : [
          "/sign-in",
          "/sign-out",
          "/register",
          "/recover",
          "/reset-password",
        ].includes(location.pathname) ? (
        <p>
          Account sign-in and password actions are disabled in preview. Use Exit
          account preview.
        </p>
      ) : (
        <QueryClientProvider client={cache}>
          <AccountPreviewIdentity member={query.data!.member}>
            <div
              onClickCapture={(e) => {
                const link = (e.target as HTMLElement).closest("a");
                const href = link?.getAttribute("href") ?? "";
                if (
                  /^(tel:|mailto:|https:\/\/pay\.buyani\.com\/)/i.test(href)
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  setMessage(
                    "Payments and contact actions are disabled in read-only account preview.",
                  );
                }
              }}
              onSubmitCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMessage(
                  "Read-only preview: submitting changes is disabled.",
                );
              }}
            >
              {children}
            </div>
          </AccountPreviewIdentity>
        </QueryClientProvider>
      )}
    </div>
  );
}
