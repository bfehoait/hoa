import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { Download, Eye } from "lucide-react";
import { Button, Feedback, Skeleton } from "./UI";

const PdfViewer = lazy(() => import("./PdfViewer"));

class ViewerBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div>
        <p role="alert">
          The PDF viewer could not load. You can still use Download PDF.
        </p>
        <Button type="button" secondary onClick={this.props.onClose}>
          Close preview
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}

/** Both public files and permission-checked private attachments use this UI.
 * The caller owns authorization; no signed URL is persisted in browser storage. */
export default function PdfAttachment({
  title,
  filename,
  loadFile,
}: {
  title: string;
  filename: string;
  loadFile: () => Promise<Blob>;
}) {
  const [file, setFile] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  async function open(download: boolean) {
    setBusy(true);
    setError(null);
    try {
      const blob = await loadFile();
      if (
        new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer()) !==
        "%PDF-"
      )
        throw new Error("This PDF could not be opened. Please try again.");
      if (download) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename.replace(/[\\/]/g, "-");
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else setFile(blob);
    } catch {
      setError(new Error("The PDF could not be opened. Please try again."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="btn-row">
        <Button
          type="button"
          secondary
          disabled={busy}
          onClick={() => void open(false)}
        >
          <Eye size={18} aria-hidden="true" /> View PDF
        </Button>
        <Button
          type="button"
          secondary
          disabled={busy}
          onClick={() => void open(true)}
        >
          <Download size={18} aria-hidden="true" /> Download PDF
        </Button>
      </div>
      {busy && <Skeleton variant="section" label="Loading PDF" />}
      <Feedback error={error} />
      {file && (
        <ViewerBoundary onClose={() => setFile(null)}>
          <Suspense
            fallback={<Skeleton variant="section" label="Opening PDF" />}
          >
            <PdfViewer
              file={file}
              title={title}
              filename={filename}
              onClose={() => setFile(null)}
            />
          </Suspense>
        </ViewerBoundary>
      )}
    </>
  );
}
