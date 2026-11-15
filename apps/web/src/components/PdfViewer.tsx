import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Minus, Plus } from "lucide-react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import Sheet from "./Sheet";
import { Button, Skeleton } from "./UI";
import styles from "./PdfViewer.module.css";

GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfViewer({
  file,
  title,
  filename,
  onClose,
}: {
  file: Blob;
  title: string;
  filename: string;
  onClose: () => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(300);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof getDocument> | undefined;
    void file
      .arrayBuffer()
      .then((data) => {
        if (!active) return;
        task = getDocument({ data });
        return task.promise.then((document) => {
          if (active) setPdf(document);
        });
      })
      .catch(() => {
        if (active) {
          setError(
            "This PDF could not be displayed. You can download it below.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
      void task?.destroy();
    };
  }, [file]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(200, entry.contentRect.width)),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf) return;
    let active = true;
    let render:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    void pdf
      .getPage(page)
      .then(async (current) => {
        if (!active || !canvas.current) return;
        setLoading(true);
        setText("");
        setError("");
        const viewport = current.getViewport({
          scale: (width / current.getViewport({ scale: 1 }).width) * zoom,
        });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const element = canvas.current;
        element.width = Math.floor(viewport.width * ratio);
        element.height = Math.floor(viewport.height * ratio);
        element.style.width = `${viewport.width}px`;
        element.style.height = `${viewport.height}px`;
        render = current.render({
          canvas: element,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        await render.promise;
        const content = await current.getTextContent();
        if (active) {
          setText(
            content.items
              .map((item) =>
                "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : "",
              )
              .join(""),
          );
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(
            "This page could not be displayed. You can download the PDF below.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
      render?.cancel();
    };
  }, [pdf, page, width, zoom]);
  function download() {
    const url = URL.createObjectURL(file),
      link = document.createElement("a");
    link.href = url;
    link.download = filename.replace(/[\\/]/g, "-");
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return (
    <Sheet
      title={title}
      size="lg"
      className={styles.viewer}
      onClose={onClose}
      footer={
        <div data-sheet-actions>
          <Button type="button" secondary onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={download}>
            <Download size={18} aria-hidden="true" />
            Download PDF
          </Button>
        </div>
      }
    >
      <div className={styles.toolbar}>
        <div className={styles.controls} role="group" aria-label="PDF pages">
          <Button
            type="button"
            secondary
            disabled={!pdf || page === 1}
            aria-label="Previous page"
            title="Previous page"
            onClick={() => setPage((value) => value - 1)}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </Button>
          <span aria-live="polite">
            {pdf ? `Page ${page} of ${pdf.numPages}` : "Loading…"}
          </span>
          <Button
            type="button"
            secondary
            disabled={!pdf || page === pdf.numPages}
            aria-label="Next page"
            title="Next page"
            onClick={() => setPage((value) => value + 1)}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </Button>
        </div>
        <div className={styles.zoom} role="group" aria-label="PDF zoom">
          <Button
            type="button"
            secondary
            aria-label="Zoom out"
            title="Zoom out"
            disabled={!pdf || zoom <= 1}
            onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
          >
            <Minus size={20} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            tone="quiet"
            className={styles.reset}
            aria-label={`Zoom ${Math.round(zoom * 100)} percent. Reset to page width`}
            title="Reset to page width"
            disabled={!pdf}
            onClick={() => {
              setZoom(1);
              if (container.current) container.current.scrollLeft = 0;
            }}
          >
            <span aria-live="polite">{Math.round(zoom * 100)}%</span>
            <small>Reset</small>
          </Button>
          <Button
            type="button"
            secondary
            aria-label="Zoom in"
            title="Zoom in"
            disabled={!pdf || zoom >= 3}
            onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
          >
            <Plus size={20} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {zoom > 1 && (
        <p className={styles.hint}>
          Scroll sideways to read the enlarged page.
        </p>
      )}
      {loading && <Skeleton variant="section" label="Loading page" />}
      {error && <p role="alert">{error}</p>}
      <div ref={container} className={styles.page} aria-busy={loading}>
        <canvas
          ref={canvas}
          role="img"
          aria-label={`Page ${page}. Readable text follows below.`}
          hidden={!!error}
        />
      </div>
      {text && (
        <details className={styles.text}>
          <summary>Read page text</summary>
          <p>{text}</p>
        </details>
      )}
    </Sheet>
  );
}
