import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Send } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import PdfViewer from "../../components/PdfViewer";
import { Button, Feedback, Skeleton } from "../../components/UI";
import Sheet from "../../components/Sheet";
import { useAuth } from "../../data/auth";
import { downloadFile } from "../../data/download";
import { featureRpc } from "../../data/feature-records";
import { mandatoryDocumentHref } from "../../../../../packages/shared/src/mandatory-documents";
import listStyles from "./DocumentLibrary.module.css";

// Community documents are view-only. Downloading needs a request that an
// admin approves; an approval unlocks the download for 7 days (migration 093).
const accessSchema = z.array(
  z.object({
    document: z.string(),
    status: z.enum(["Pending", "Approved", "Declined", "Expired"]),
    expires_at: z.string().nullable(),
    note: z.string(),
  }),
);
export type DocumentAccess = z.infer<typeof accessSchema>[number];

export function useDocumentAccess() {
  const auth = useAuth();
  return useQuery({
    queryKey: ["document-access", auth.userId],
    retry: false,
    refetchInterval: 30000,
    queryFn: async () =>
      new Map(
        accessSchema
          .parse(await featureRpc("bfe_my_document_access", {}))
          .map((a) => [a.document, a]),
      ),
  });
}

const until = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    day: "numeric",
    month: "short",
  });

/** Short status shown beside a document in the lists. */
export function DocumentStatusTag({
  access,
  idle = "View",
}: {
  access?: DocumentAccess;
  /** Label when there is no request yet ("View" or "Request"). */
  idle?: string;
}) {
  if (access?.status === "Pending")
    return <span className={listStyles.tag}>Requested</span>;
  if (access?.status === "Approved" && access.expires_at)
    return (
      <span className={`${listStyles.tag} ${listStyles.tagApproved}`}>
        Download until {until(access.expires_at)}
      </span>
    );
  return <span className={listStyles.tagView}>{idle}</span>;
}

export default function CommunityDocumentViewer({
  name,
  file,
  access,
  onClose,
  viewable = true,
}: {
  name: string;
  file: string;
  access?: DocumentAccess;
  onClose: () => void;
  /** False for Right to Inspect records: request a download, no viewing. */
  viewable?: boolean;
}) {
  const cache = useQueryClient();
  const [notice, setNotice] = useState("");
  const pdf = useQuery({
    queryKey: ["community-document-file", file],
    staleTime: Infinity,
    enabled: viewable,
    queryFn: async () => {
      const response = await fetch(mandatoryDocumentHref(file));
      if (!response.ok) throw new Error("This document is unavailable.");
      return response.blob();
    },
  });
  const request = useMutation({
    mutationFn: () =>
      featureRpc("bfe_request_document_download", { p_document: name }),
    onSuccess: async () => {
      setNotice(
        "Request sent. The HOA office will review it, and you will be notified.",
      );
      await cache.invalidateQueries({ queryKey: ["document-access"] });
    },
  });
  const download = useMutation({
    mutationFn: async () => {
      await featureRpc("bfe_record_document_download", { p_document: name });
      downloadFile(mandatoryDocumentHref(file), file);
    },
    onSuccess: () => setNotice("Your download has started."),
  });
  const approved = access?.status === "Approved" && !!access.expires_at;
  const actions = (
    <>
      {approved ? (
        <Button
          type="button"
          pending={download.isPending}
          onClick={() => download.mutate()}
        >
          <Download size={18} aria-hidden="true" />
          Download PDF (until {until(access.expires_at!)})
        </Button>
      ) : access?.status === "Pending" ? (
        <Button type="button" disabled>
          Download requested
        </Button>
      ) : (
        <Button
          type="button"
          pending={request.isPending}
          onClick={() => request.mutate()}
        >
          <Send size={18} aria-hidden="true" />
          {access?.status === "Declined" || access?.status === "Expired"
            ? "Request download again"
            : "Request download"}
        </Button>
      )}
    </>
  );
  const status =
    access?.status === "Pending"
      ? "Waiting for the HOA office to approve your download request."
      : access?.status === "Declined"
        ? `The HOA office declined your last request.${access.note ? ` Note: ${access.note}` : ""}`
        : access?.status === "Expired"
          ? "Your approved download period has ended."
          : approved
            ? "Your download request was approved."
            : viewable
              ? "View only. To get a copy, request a download from the HOA office."
              : "This record is kept at the HOA office. You may inspect it there during office hours, or request a downloadable copy here.";
  if (!viewable)
    return (
      <Sheet
        title={name}
        onClose={onClose}
        footer={
          <div data-sheet-actions>
            <Button type="button" secondary onClick={onClose}>
              Close
            </Button>
            {actions}
          </div>
        }
      >
        <p className={listStyles.requestStatus} role="status">
          {notice || status}
        </p>
        <Feedback error={request.error ?? download.error} />
      </Sheet>
    );
  if (!pdf.isSuccess)
    return (
      <Sheet title={name} size="lg" onClose={onClose}>
        {pdf.isError ? <Feedback error={pdf.error} /> : <Skeleton />}
      </Sheet>
    );
  return (
    <PdfViewer
      file={pdf.data}
      title={name}
      filename={file}
      onClose={onClose}
      viewOnly
      actions={
        <>
          <p className={listStyles.viewerStatus} role="status">
            {notice || status}
          </p>
          <Feedback error={request.error ?? download.error} />
          {actions}
        </>
      }
    />
  );
}
