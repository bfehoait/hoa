import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { featureRpc } from "../../data/feature-records";
import { Button, Feedback } from "../../components/UI";

const schema = z.object({
  reference: z.string(),
  valid_from: z.string(),
  valid_until: z.string().nullable(),
  issued_at: z.string(),
  title: z.string(),
  permit: z.string().nullable(),
  unit: z.string().nullable(),
});
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export default function IssuedPermit({ id }: { id: string }) {
  const download = useMutation({
    mutationFn: async () => {
      const permit = schema
        .nullable()
        .parse(await featureRpc("bfe_issued_permit", { p_id: id }));
      if (!permit) throw new Error("Office has not issued this permit yet.");
      const rows = [
        ["Official Reference", permit.reference],
        ["Permit", permit.permit ?? permit.title],
        ["Property", permit.unit ?? "Not recorded"],
        ["Valid From", permit.valid_from],
        ["Valid Until", permit.valid_until ?? "Not recorded"],
        ["Issued", permit.issued_at],
      ];
      const html =
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Issued Permit</title><style>body{font:16px Arial,sans-serif;max-width:720px;margin:32px auto;padding:24px;color:#222}h1{font-size:28px}dl>div{display:grid;grid-template-columns:160px 1fr;gap:16px;padding:12px;border-bottom:1px solid #ddd}dd{margin:0;font-weight:bold;overflow-wrap:anywhere}@media print{body{margin:0}}</style><h1>Bellefort Estates · Issued Permit</h1><dl>' +
        rows
          .map(
            ([label, value]) =>
              "<div><dt>" +
              escape(label) +
              "</dt><dd>" +
              escape(value) +
              "</dd></div>",
          )
          .join("") +
        "</dl><p>This copy reflects the Office issuance record. Print this page for display at the property.</p></html>";
      const url = URL.createObjectURL(
        new Blob([html], { type: "text/html;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `Permit-${permit.reference.replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  return (
    <>
      <Button
        secondary
        pending={download.isPending}
        onClick={() => download.mutate()}
      >
        Download Printable Permit
      </Button>
      <p>
        Open the downloaded file and choose Print. You can also save it as PDF
        from the print menu.
      </p>
      <Feedback error={download.error} />
    </>
  );
}
