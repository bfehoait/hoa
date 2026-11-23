// Writes clearly labelled SAMPLE PDFs for the Mandatory Documents list
// (Community documents). They are synthetic placeholders, not HOA records; the
// office replaces each file with the approved document using the same name.
// Run from the repository root: node scripts/generate-mandatory-samples.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const mandatorySampleFiles = JSON.parse(
  readFileSync(
    new URL("../packages/shared/src/mandatory-documents.json", import.meta.url),
    "utf8",
  ),
);

const outDir = new URL("../public/documents/mandatory/", import.meta.url);
mkdirSync(outDir, { recursive: true });

// PDF text strings need (, ) and \ escaped; keep to plain ASCII.
const text = (s) => s.replace(/[‘’]/g, "'").replace(/[\\()]/g, (c) => "\\" + c);

function wrap(line, width = 78) {
  const words = line.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > width) {
      lines.push(current.trim());
      current = word;
    } else current += " " + word;
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

function pdf(title) {
  const body = [
    ["F2", 20, "Bellefort Estates Homeowners Association"],
    ["F2", 16, title],
    ["F2", 13, "SAMPLE DOCUMENT - NOT AN OFFICIAL HOA RECORD"],
    ...wrap(
      "This file is a synthetic placeholder created to test the Bellefort community portal. It contains no real figures, names or decisions.",
    ).map((l) => ["F1", 11, l]),
    ["F1", 11, ""],
    ...wrap(
      "The HOA office will replace it with the approved document before members rely on it. Under R.A. No. 9904 and its implementing rules, the Board posts this kind of document in common areas.",
    ).map((l) => ["F1", 11, l]),
    ["F1", 11, ""],
    ["F1", 10, "Sample prepared 23 November 2026."],
  ];
  let y = 760;
  const stream = body
    .map(([font, size, line]) => {
      const out = `BT /${font} ${size} Tf 56 ${y} Td (${text(line)}) Tj ET`;
      y -= size + (font === "F2" ? 14 : 6);
      return out;
    })
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    `<< /Title (${text(title)} - SAMPLE) /Producer (Bellefort portal sample generator) >>`,
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets
    .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
    .join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

for (const { name, file } of mandatorySampleFiles) {
  writeFileSync(new URL(file, outDir), pdf(name), "latin1");
  console.log("wrote", file);
}
