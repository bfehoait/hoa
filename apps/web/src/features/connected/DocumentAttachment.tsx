import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { makeClient, useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import { Button, Feedback } from "../../components/UI";
const schema = z.object({
  path: z.string().nullable(),
  name: z.string().nullable(),
  ready: z.boolean(),
  can_upload: z.boolean(),
});
export default function DocumentAttachment({ record }: { record: string }) {
  const auth = useAuth(),
    cache = useQueryClient(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const query = useQuery({
    queryKey: ["document-attachment", auth.userId, record],
    enabled: !auth.memberPreview,
    retry: false,
    gcTime: 0,
    queryFn: async () =>
      schema.parse(
        await featureRpc("bfe_document_attachment", { p_record: record }),
      ),
  });
  async function open(download: boolean) {
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    setBusy(true);
    setError(null);
    try {
      const client = makeClient();
      if (!client || !query.data?.path)
        throw new Error("Document unavailable.");
      const result = await client.storage
        .from("bfe-documents")
        .createSignedUrl(
          query.data.path,
          60,
          download ? { download: query.data.name ?? true } : undefined,
        );
      if (result.error)
        throw new Error("The file could not be opened. Try again.");
      if (!tab)
        throw new Error("Allow a new tab to view or download this document.");
      tab.location.href = result.data.signedUrl;
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e : new Error("Document unavailable."));
    } finally {
      setBusy(false);
    }
  }
  if (auth.memberPreview)
    return (
      <p className="note">File actions are unavailable in account preview.</p>
    );
  return (
    <div>
      <Feedback error={query.error ?? error} />
      {query.isPending ? (
        <p className="note">Loading document...</p>
      ) : query.data?.ready ? (
        <div className="btn-row">
          <Button secondary disabled={busy} onClick={() => void open(false)}>
            View PDF
          </Button>
          <Button secondary disabled={busy} onClick={() => void open(true)}>
            Download PDF
          </Button>
        </div>
      ) : query.isError ? (
        <Button secondary onClick={() => void query.refetch()}>
          Try again
        </Button>
      ) : (
        <p className="note">No PDF is attached to this document.</p>
      )}
      {query.data?.can_upload && !query.data.ready && (
        <label style={{ display: "block", minHeight: 48 }}>
          Attach PDF (up to 10 MB)
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setBusy(true);
              setError(null);
              try {
                if (
                  file.size > 10485760 ||
                  new TextDecoder().decode(
                    await file.slice(0, 5).arrayBuffer(),
                  ) !== "%PDF-"
                )
                  throw new Error("Choose a PDF under 10 MB.");
                const path = z.string().parse(
                  await featureRpc("bfe_prepare_document", {
                    p_record: record,
                    p_name: file.name,
                  }),
                );
                const client = makeClient();
                if (!client) throw new Error("Sign in again.");
                const upload = await client.storage
                  .from("bfe-documents")
                  .upload(path, file, {
                    contentType: "application/pdf",
                    upsert: false,
                  });
                if (upload.error)
                  throw new Error(
                    "Upload not confirmed. Refresh before retrying.",
                  );
                void cache.invalidateQueries({
                  queryKey: ["document-attachment"],
                });
                void cache.invalidateQueries({ queryKey: ["feature-records"] });
              } catch (e) {
                setError(e instanceof Error ? e : new Error("Upload failed."));
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      )}
    </div>
  );
}
