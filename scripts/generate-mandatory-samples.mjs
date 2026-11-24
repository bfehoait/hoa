// Writes realistic, clearly labelled SAMPLE PDFs for the Mandatory Documents
// list (Community documents). All names, dates and figures are made up; the
// office replaces each file with the approved document using the same name.
// Run from the repository root: node scripts/generate-mandatory-samples.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const list = JSON.parse(
  readFileSync(
    new URL("packages/shared/src/mandatory-documents.json", root),
    "utf8",
  ),
);
const inspection = JSON.parse(
  readFileSync(
    new URL("packages/shared/src/inspection-records.json", root),
    "utf8",
  ),
);
const allDocs = [...list, ...inspection];
const outDir = new URL("public/documents/mandatory/", root);
mkdirSync(outDir, { recursive: true });

const BURGUNDY = [0.49, 0.1, 0.16];
const INK = [0.13, 0.12, 0.13];
const MUTED = [0.42, 0.4, 0.42];
const LINE = [0.82, 0.79, 0.8];
const WASH = [0.96, 0.94, 0.95];
const PAGE_W = 612,
  PAGE_H = 792,
  LEFT = 54,
  RIGHT = PAGE_W - 54;

// ---- Logo: decode the palette PNG and composite it over white as RGB. ----
function decodeLogo(path) {
  const b = readFileSync(path);
  let o = 8,
    width = 0,
    height = 0,
    palette = null,
    alpha = null;
  const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o),
      type = b.toString("ascii", o + 4, o + 8),
      data = b.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 3 || data[12] !== 0)
        throw new Error("Expected an 8-bit, non-interlaced palette PNG logo.");
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") alpha = data;
    else if (type === "IDAT") idat.push(data);
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const rows = Buffer.alloc(width * height);
  let prev = Buffer.alloc(width);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (width + 1)];
    const line = raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1));
    const cur = Buffer.alloc(width);
    for (let x = 0; x < width; x++) {
      const a = x ? cur[x - 1] : 0,
        up = prev[x],
        c = x ? prev[x - 1] : 0;
      const p = a + up - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - up),
        pc = Math.abs(p - c);
      const pred = [
        0,
        a,
        up,
        (a + up) >> 1,
        pa <= pb && pa <= pc ? a : pb <= pc ? up : c,
      ][filter];
      cur[x] = (line[x] + pred) & 255;
    }
    cur.copy(rows, y * width);
    prev = cur;
  }
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const idx = rows[i],
      t = alpha && idx < alpha.length ? alpha[idx] / 255 : 1;
    for (let k = 0; k < 3; k++)
      rgb[i * 3 + k] = Math.round(palette[idx * 3 + k] * t + 255 * (1 - t));
  }
  return { width, height, data: deflateSync(rgb) };
}
const logo = decodeLogo(new URL("public/brand/bellefort-logo.png", root));

// ---- Minimal drawing helpers (Helvetica, ASCII only). ----
const esc = (s) => s.replace(/[\\()]/g, (c) => "\\" + c);
const WIDTHS = {
  " ": 278,
  ",": 278,
  ".": 278,
  "-": 333,
  ":": 278,
  "(": 333,
  ")": 333,
  "/": 278,
  "&": 667,
  "%": 889,
  i: 222,
  l: 222,
  j: 222,
  t: 278,
  f: 278,
  r: 333,
  I: 278,
  J: 500,
  m: 833,
  w: 722,
  M: 833,
  W: 944,
};
const textWidth = (s, size, bold = false) =>
  ([...s].reduce(
    (sum, ch) => sum + (WIDTHS[ch] ?? (/[A-Z]/.test(ch) ? 667 : 556)),
    0,
  ) *
    size *
    (bold ? 1.05 : 1)) /
  1000;
function wrap(s, size, width, bold = false) {
  const out = [];
  let line = "";
  for (const word of s.split(" ")) {
    const next = line ? line + " " + word : word;
    if (textWidth(next, size, bold) > width && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
class Page {
  ops = [];
  y = PAGE_H - 54;
  color(c) {
    return `${c.map((v) => v.toFixed(3)).join(" ")}`;
  }
  text(x, y, s, { size = 10, bold = false, color = INK } = {}) {
    this.ops.push(
      `${this.color(color)} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s)}) Tj ET`,
    );
  }
  rect(x, y, w, h, fill) {
    this.ops.push(`${this.color(fill)} rg ${x} ${y} ${w} ${h} re f`);
  }
  line(x1, y1, x2, y2, c = LINE, w = 0.6) {
    this.ops.push(`${this.color(c)} RG ${w} w ${x1} ${y1} m ${x2} ${y2} l S`);
  }
  para(
    s,
    {
      size = 10,
      bold = false,
      color = INK,
      gap = 4,
      x = LEFT,
      width = RIGHT - LEFT,
    } = {},
  ) {
    for (const l of wrap(s, size, width, bold)) {
      this.text(x, this.y, l, { size, bold, color });
      this.y -= size + gap;
    }
  }
  heading(s) {
    this.y -= 8;
    this.text(LEFT, this.y, s, { size: 12, bold: true, color: BURGUNDY });
    this.y -= 6;
    this.line(LEFT, this.y, RIGHT, this.y, BURGUNDY, 0.8);
    this.y -= 14;
  }
  bullets(items, size = 10, numbered = false) {
    for (const [n, item] of items.entries()) {
      const lines = wrap(item, size, RIGHT - LEFT - 16);
      this.text(LEFT + 4, this.y, numbered ? `${n + 1}.` : "-", { size });
      lines.forEach((l, i) => {
        this.text(LEFT + 16, this.y, l, { size });
        if (i < lines.length - 1) this.y -= size + 3;
      });
      this.y -= size + 6;
    }
  }
  /** cols: [{ label, width, align }]; rows: string[][]; bold rows via { cells }. */
  table(cols, rows, size = 9) {
    const pad = 5,
      lh = size + 3;
    const drawRow = (
      cells,
      { header = false, bold = false, shade = false } = {},
    ) => {
      const wrapped = cells.map((c, i) =>
        wrap(String(c), size, cols[i].width - pad * 2, header || bold),
      );
      const h = Math.max(...wrapped.map((w) => w.length)) * lh + pad * 2 - 3;
      if (header) this.rect(LEFT, this.y - h, RIGHT - LEFT, h, BURGUNDY);
      else if (shade) this.rect(LEFT, this.y - h, RIGHT - LEFT, h, WASH);
      let x = LEFT;
      wrapped.forEach((lines, i) => {
        lines.forEach((l, k) => {
          const w = textWidth(l, size, header || bold);
          const tx =
            cols[i].align === "right" ? x + cols[i].width - pad - w : x + pad;
          this.text(tx, this.y - pad - size + 2 - k * lh, l, {
            size,
            bold: header || bold,
            color: header ? [1, 1, 1] : INK,
          });
        });
        x += cols[i].width;
      });
      this.y -= h;
      if (!header) this.line(LEFT, this.y, RIGHT, this.y);
    };
    drawRow(
      cols.map((c) => c.label),
      { header: true },
    );
    rows.forEach((r, i) =>
      Array.isArray(r)
        ? drawRow(r, { shade: i % 2 === 1 })
        : drawRow(r.cells, { bold: true }),
    );
    this.y -= 12;
  }
  signature(labels) {
    this.y -= 34;
    const w = Math.min(
      240,
      (RIGHT - LEFT - 30 * (labels.length - 1)) / labels.length,
    );
    labels.forEach(([name, role], i) => {
      const x = LEFT + i * (w + 30);
      this.line(x, this.y, x + w, this.y, INK, 0.6);
      this.text(x, this.y - 12, name, { size: 9, bold: true });
      this.text(x, this.y - 23, role, { size: 8.5, color: MUTED });
    });
    this.y -= 34;
  }
}

function frame(page, title, subtitle) {
  // Light diagonal watermark behind the content.
  page.ops.unshift(
    `q 0.95 0.93 0.94 rg BT /F2 110 Tf 0.766 0.643 -0.643 0.766 150 210 Tm (SAMPLE) Tj ET Q`,
  );
  const logoW = 150,
    logoH = (logo.height / logo.width) * logoW;
  page.ops.push(
    `q ${logoW} 0 0 ${logoH.toFixed(2)} ${LEFT} ${(PAGE_H - 40 - logoH).toFixed(2)} cm /Logo Do Q`,
  );
  // SAMPLE badge.
  page.rect(RIGHT - 128, PAGE_H - 70, 128, 24, BURGUNDY);
  page.text(RIGHT - 117, PAGE_H - 62, "SAMPLE DOCUMENT", {
    size: 10,
    bold: true,
    color: [1, 1, 1],
  });
  page.text(RIGHT - 128, PAGE_H - 84, "Not an official HOA record", {
    size: 8,
    color: MUTED,
  });
  page.y = PAGE_H - 40 - logoH - 26;
  page.line(LEFT, page.y + 12, RIGHT, page.y + 12, BURGUNDY, 1.2);
  page.text(LEFT, page.y - 6, title, { size: 17, bold: true, color: INK });
  page.y -= 24;
  if (subtitle) {
    page.text(LEFT, page.y, subtitle, { size: 10, color: MUTED });
    page.y -= 18;
  }
  page.y -= 4;
}
function footer(page) {
  page.line(LEFT, 46, RIGHT, 46);
  page.text(
    LEFT,
    33,
    "Bellefort Estates Homeowners Association  -  Bacoor, Cavite",
    { size: 8, color: MUTED },
  );
  page.text(
    LEFT,
    22,
    "SAMPLE prepared 23 November 2026 to test the community portal. Names, dates and figures are illustrative only.",
    { size: 7.5, color: MUTED },
  );
}

// ---- Document content (all synthetic). ----
const peso = (n) =>
  "PHP " + n.toLocaleString("en-US", { minimumFractionDigits: 2 });
const docs = {
  "annual-financial-statements.pdf": (p) => {
    frame(
      p,
      "Annual Financial Statements",
      "For the year ended 31 December 2025 (illustrative figures)",
    );
    p.heading("Statement of Financial Position");
    const money = [
      { label: "Account", width: 344 },
      { label: "Amount", width: 160, align: "right" },
    ];
    p.table(money, [
      ["Cash on hand and in bank", peso(1284500)],
      ["Association dues receivable", peso(312750)],
      ["Prepaid insurance and deposits", peso(48000)],
      { cells: ["Total assets", peso(1645250)] },
      ["Accounts payable and accrued expenses", peso(186400)],
      ["Security deposits from residents", peso(95000)],
      { cells: ["Members' equity (fund balance)", peso(1363850)] },
    ]);
    p.heading("Statement of Income and Expenses");
    p.table(money, [
      ["Association dues", peso(2940000)],
      ["Amenity and clubhouse fees", peso(214500)],
      ["Interest and other income", peso(18240)],
      { cells: ["Total income", peso(3172740)] },
      ["Security services", peso(1320000)],
      ["Utilities (street lights, water, clubhouse)", peso(486300)],
      ["Repairs and maintenance", peso(392150)],
      ["Salaries and benefits (office staff)", peso(540000)],
      ["Administrative and professional fees", peso(176400)],
      { cells: ["Excess of income over expenses", peso(257890)] },
    ]);
    p.para(
      "Notes: Figures are illustrative only and do not describe Bellefort Estates finances. The approved statements will carry the external auditor's report.",
      { size: 8.5, color: MUTED },
    );
    p.signature([
      ["Sample Treasurer", "Treasurer"],
      ["Sample President", "President, Board of Directors"],
    ]);
  },
  "notice-of-elections-and-guidelines.pdf": (p) => {
    frame(
      p,
      "Notice of Elections and Election Guidelines",
      "Election of members of the Board of Directors (sample)",
    );
    p.para(
      "Notice is hereby given that the annual election of the Board of Directors of Bellefort Estates Homeowners Association will be held as follows:",
    );
    p.y -= 4;
    p.table(
      [
        { label: "Item", width: 150 },
        { label: "Details", width: 354 },
      ],
      [
        ["Date", "Sunday, 15 March 2026"],
        ["Time", "8:00 AM to 3:00 PM (counting starts at 3:30 PM)"],
        ["Venue", "Bellefort Estates Clubhouse"],
        ["Seats to be filled", "Five (5) seats, each for a two-year term"],
        [
          "Filing of candidacy",
          "16 to 27 February 2026 at the HOA office, 9:00 AM to 5:00 PM",
        ],
        [
          "Posting of qualified voters",
          "On or before 2 March 2026 at the clubhouse and gate bulletin boards",
        ],
      ],
    );
    p.heading("Election guidelines");
    p.bullets([
      "Only members in good standing may vote or run for office. Dues must be fully paid by the cut-off date stated by the Election Committee.",
      "One vote per lot. Co-owners of one lot agree among themselves who will cast the vote.",
      "Proxies must be written, signed by the member, and filed with the Election Committee at least two days before the election.",
      "Bring a valid ID. Campaigning is not allowed within 20 meters of the voting area on election day.",
      "Protests must be filed in writing with the Election Committee within 24 hours after the results are announced.",
    ]);
    p.signature([
      ["Sample Chair", "Chair, Election Committee"],
      ["Sample Secretary", "Corporate Secretary"],
    ]);
  },
  "master-list-of-qualified-voters.pdf": (p) => {
    frame(
      p,
      "Master List of Qualified Voters",
      "Members in good standing as of 1 March 2026 (sample entries)",
    );
    const rows = [];
    for (let i = 1; i <= 18; i++) {
      const phase = 1 + (i > 9 ? 1 : 0),
        block = 1 + ((i - 1) % 4),
        lot = 1 + ((i * 3) % 20);
      rows.push([
        String(i),
        `${phase}-${String(block).padStart(2, "0")}-${String(lot).padStart(3, "0")}`,
        `Sample Member ${String(i).padStart(3, "0")}`,
        i % 6 === 0 ? "Proxy on file" : "Good standing",
      ]);
    }
    p.table(
      [
        { label: "No.", width: 40 },
        { label: "Phase-Block-Lot", width: 110 },
        { label: "Member", width: 214 },
        { label: "Status", width: 140 },
      ],
      rows,
      9,
    );
    p.para(
      "Total qualified voters on this sample list: 18. Members who believe they were left out may ask the Election Committee for a review before the election.",
      { size: 9, color: MUTED },
    );
    p.signature([["Sample Chair", "Chair, Election Committee"]]);
  },
  "official-election-results.pdf": (p) => {
    frame(
      p,
      "Official Election Results and Tally",
      "Election of 15 March 2026 (sample)",
    );
    p.table(
      [
        { label: "Candidate", width: 214 },
        { label: "Votes", width: 90, align: "right" },
        { label: "Rank", width: 70, align: "right" },
        { label: "Result", width: 130 },
      ],
      [
        ["Sample Candidate A", "412", "1", "Elected"],
        ["Sample Candidate B", "398", "2", "Elected"],
        ["Sample Candidate C", "377", "3", "Elected"],
        ["Sample Candidate D", "351", "4", "Elected"],
        ["Sample Candidate E", "329", "5", "Elected"],
        ["Sample Candidate F", "214", "6", "Not elected"],
        ["Sample Candidate G", "188", "7", "Not elected"],
      ],
    );
    p.heading("Turnout");
    p.table(
      [
        { label: "Measure", width: 344 },
        { label: "Count", width: 160, align: "right" },
      ],
      [
        ["Qualified voters", "640"],
        ["Ballots cast (including 38 proxies)", "486"],
        ["Spoiled ballots", "6"],
        { cells: ["Turnout", "75.9%"] },
      ],
    );
    p.para(
      "We certify that the results above are true and correct based on the ballots canvassed in the presence of the candidates' watchers.",
      { size: 9.5 },
    );
    p.signature([
      ["Sample Chair", "Chair, Election Committee"],
      ["Sample Member", "Member, Election Committee"],
      ["Sample Member", "Member, Election Committee"],
    ]);
  },
  "notice-of-general-assembly.pdf": (p) => {
    frame(
      p,
      "Notice of General Assembly",
      "Annual general membership meeting (sample)",
    );
    p.para(
      "All members of Bellefort Estates Homeowners Association are invited to the annual General Assembly:",
    );
    p.y -= 4;
    p.table(
      [
        { label: "Item", width: 150 },
        { label: "Details", width: 354 },
      ],
      [
        [
          "Date and time",
          "Saturday, 28 February 2026, 2:00 PM (registration from 1:00 PM)",
        ],
        ["Venue", "Bellefort Estates Clubhouse"],
        [
          "Quorum",
          "Majority of members in good standing, in person or by proxy",
        ],
      ],
    );
    p.heading("Agenda");
    p.bullets(
      [
        "Call to order and determination of quorum",
        "Approval of the minutes of the previous General Assembly",
        "President's report on the year's projects",
        "Treasurer's report and presentation of the Annual Financial Statements",
        "Proposed amendments to the By-Laws (see separate notice)",
        "Open forum",
        "Adjournment",
      ],
      10,
      true,
    );
    p.y -= 6;
    p.para(
      "Members who cannot attend may send a signed proxy to the HOA office at least two days before the meeting. Light snacks will be served.",
      { size: 9.5 },
    );
    p.signature([["Sample Secretary", "Corporate Secretary"]]);
  },
  "proposed-amendments-articles-by-laws.pdf": (p) => {
    frame(
      p,
      "Proposed Amendments to the By-Laws",
      "For discussion and vote at the General Assembly (sample)",
    );
    p.table(
      [
        { label: "Provision", width: 96 },
        { label: "Current text", width: 204 },
        { label: "Proposed text", width: 204 },
      ],
      [
        [
          "Art. III, Sec. 2 (Board size)",
          "The Board of Directors shall have seven (7) members.",
          "The Board of Directors shall have nine (9) members, elected in staggered terms.",
        ],
        [
          "Art. IV, Sec. 5 (Meetings)",
          "The Board shall meet at least once every quarter.",
          "The Board shall meet at least once a month. Minutes shall be available to members within 30 days.",
        ],
        [
          "Art. VII, Sec. 1 (Dues)",
          "Monthly dues shall be fixed by the Board.",
          "Monthly dues shall be proposed by the Board and approved by a majority of members in good standing.",
        ],
        [
          "Art. IX, Sec. 3 (Records)",
          "Records shall be kept at the HOA office.",
          "Records shall be kept at the HOA office and made available for inspection during office hours.",
        ],
      ],
      8.5,
    );
    p.para(
      "Adoption requires the vote of the majority of members in good standing, and the amendments take effect upon approval by the Department of Human Settlements and Urban Development (DHSUD).",
      { size: 9.5 },
    );
    p.signature([
      ["Sample Secretary", "Corporate Secretary"],
      ["Sample President", "President, Board of Directors"],
    ]);
  },
  "house-rules-traffic-parking-fees.pdf": (p) => {
    frame(
      p,
      "House Rules, Traffic and Parking Rules, and Fee/Fine Schedule",
      "Effective 1 April 2026 (sample)",
    );
    p.heading("Traffic and parking");
    p.bullets([
      "Speed limit inside the subdivision is 20 km/h. Give way to pedestrians and children at all times.",
      "Park only inside your lot or in marked visitor slots. No overnight parking on streets or sidewalks.",
      "Delivery and construction vehicles may enter from 8:00 AM to 5:00 PM, Monday to Saturday.",
      "Keep noise down from 10:00 PM to 6:00 AM. Pets must be leashed outside your property.",
    ]);
    p.heading("Fee and fine schedule");
    p.table(
      [
        { label: "Item or violation", width: 214 },
        { label: "First", width: 96, align: "right" },
        { label: "Second", width: 97, align: "right" },
        { label: "Third", width: 97, align: "right" },
      ],
      [
        ["Overspeeding", peso(500), peso(1000), peso(2000)],
        [
          "Illegal or overnight street parking",
          peso(300),
          peso(600),
          peso(1000),
        ],
        [
          "Unleashed pet / pet waste not cleaned",
          peso(300),
          peso(500),
          peso(1000),
        ],
        ["Noise after 10:00 PM", "Warning", peso(500), peso(1000)],
        [
          "Construction outside allowed hours",
          peso(1000),
          peso(2000),
          peso(3000),
        ],
      ],
    );
    p.table(
      [
        { label: "Fee", width: 344 },
        { label: "Amount", width: 160, align: "right" },
      ],
      [
        ["Vehicle sticker (per vehicle, per year)", peso(250)],
        ["Clubhouse rental (per 4 hours)", peso(2500)],
        ["Gate pass for move-in or move-out", peso(200)],
      ],
    );
  },
  // ---- Right to Inspect records (R.A. 9904, Sections 7(b) and 17). ----
  "articles-of-incorporation-and-by-laws.pdf": (p) => {
    frame(
      p,
      "Articles of Incorporation and By-Laws",
      "As amended and approved (sample excerpt)",
    );
    p.heading("Articles of Incorporation");
    p.table(
      [
        { label: "Article", width: 110 },
        { label: "Summary", width: 394 },
      ],
      [
        ["First (Name)", "Bellefort Estates Homeowners Association, Inc."],
        [
          "Second (Purpose)",
          "To promote the welfare of members, maintain common areas and enforce the Deed of Restrictions.",
        ],
        [
          "Third (Principal office)",
          "Bellefort Estates Clubhouse, Bacoor, Cavite",
        ],
        [
          "Fourth (Term)",
          "Perpetual, as allowed by the Revised Corporation Code",
        ],
        [
          "Fifth (Incorporators)",
          "Sample Incorporator 1 to Sample Incorporator 5",
        ],
      ],
    );
    p.heading("By-Laws (table of contents)");
    p.bullets(
      [
        "Article I - Membership, rights and obligations",
        "Article II - General Assembly and quorum",
        "Article III - Board of Directors and elections",
        "Article IV - Officers and committees",
        "Article V - Dues, assessments and fines",
        "Article VI - Books, records and inspection",
        "Article VII - Amendments",
      ],
      10,
      true,
    );
    p.para(
      "Amendments approved: Article III, Section 2 (General Assembly of 28 February 2026, sample).",
      { size: 9, color: MUTED },
    );
    p.signature([["Sample Secretary", "Corporate Secretary"]]);
  },
  "dhsud-registration-and-gis.pdf": (p) => {
    frame(
      p,
      "DHSUD Certificate of Registration and GIS",
      "Registration details and General Information Sheet (sample)",
    );
    p.heading("Certificate of Registration");
    p.table(
      [
        { label: "Item", width: 170 },
        { label: "Details", width: 334 },
      ],
      [
        ["Registered name", "Bellefort Estates Homeowners Association, Inc."],
        ["Registration number", "SAMPLE-HOA-0000-0000"],
        ["Date of registration", "12 June 2012 (sample)"],
        ["Registering office", "DHSUD Regional Office IV-A (sample)"],
      ],
    );
    p.heading("General Information Sheet (current officers)");
    p.table(
      [
        { label: "Position", width: 170 },
        { label: "Name", width: 194 },
        { label: "Term", width: 140 },
      ],
      [
        ["President", "Sample President", "2026 to 2028"],
        ["Vice President", "Sample Vice President", "2026 to 2028"],
        ["Secretary", "Sample Secretary", "2026 to 2028"],
        ["Treasurer", "Sample Treasurer", "2026 to 2028"],
        ["Auditor", "Sample Auditor", "2026 to 2028"],
      ],
    );
    p.para("GIS filed with DHSUD on 30 March 2026 (sample).", {
      size: 9,
      color: MUTED,
    });
  },
  "minutes-book.pdf": (p) => {
    frame(
      p,
      "Minutes Book",
      "Index of General Assembly and Board meetings (sample)",
    );
    p.table(
      [
        { label: "Date", width: 90 },
        { label: "Meeting", width: 130 },
        { label: "Attendance", width: 84 },
        { label: "Key decisions", width: 200 },
      ],
      [
        [
          "28 Feb 2026",
          "General Assembly",
          "312 members",
          "Approved 2025 AFS; By-Laws amendment",
        ],
        [
          "10 Feb 2026",
          "Board meeting",
          "7 of 7",
          "Set election schedule; appointed Election Committee",
        ],
        [
          "13 Jan 2026",
          "Board meeting",
          "6 of 7",
          "Approved security contract renewal",
        ],
        ["9 Dec 2025", "Board meeting", "7 of 7", "Adopted 2026 budget"],
        [
          "11 Nov 2025",
          "Board meeting",
          "5 of 7",
          "Street light repairs, Phase 2",
        ],
        [
          "14 Oct 2025",
          "Special meeting",
          "7 of 7",
          "Drainage project funding",
        ],
      ],
    );
    p.para(
      "Full minutes for each meeting are kept in the Minutes Book at the HOA office and may be inspected during office hours.",
      { size: 9.5 },
    );
    p.signature([["Sample Secretary", "Corporate Secretary"]]);
  },
  "board-resolutions.pdf": (p) => {
    frame(
      p,
      "Compilation of Board Resolutions",
      "Policies, authorizations and administrative issuances (sample)",
    );
    p.table(
      [
        { label: "No.", width: 70 },
        { label: "Date", width: 84 },
        { label: "Subject", width: 250 },
        { label: "Status", width: 100 },
      ],
      [
        [
          "2026-07",
          "10 Feb 2026",
          "Election schedule and Election Committee",
          "In force",
        ],
        [
          "2026-05",
          "13 Jan 2026",
          "Renewal of security services contract",
          "In force",
        ],
        [
          "2026-03",
          "13 Jan 2026",
          "Guidelines for clubhouse rental",
          "In force",
        ],
        ["2025-22", "9 Dec 2025", "Adoption of the 2026 budget", "In force"],
        ["2025-19", "11 Nov 2025", "Street light repair, Phase 2", "Completed"],
        [
          "2025-15",
          "14 Oct 2025",
          "Drainage improvement project",
          "In progress",
        ],
      ],
    );
    p.signature([
      ["Sample Secretary", "Corporate Secretary"],
      ["Sample President", "President, Board of Directors"],
    ]);
  },
  "deed-of-restrictions-and-turnover.pdf": (p) => {
    frame(
      p,
      "Deed of Restrictions and Turnover Documents",
      "From the developer (sample summary)",
    );
    p.heading("Key restrictions");
    p.bullets([
      "Lots are for residential use only. Home-based businesses need Board approval and must not disturb neighbours.",
      "Building plans must be cleared by the Association before construction. Setbacks: 2 m front, 1.5 m sides (sample).",
      "No structures on easements or road right-of-way. Fences may not exceed 2.4 m.",
    ]);
    p.heading("Turnover documents received");
    p.table(
      [
        { label: "Document", width: 304 },
        { label: "Received", width: 110 },
        { label: "Copy kept", width: 90 },
      ],
      [
        ["Approved subdivision plan", "15 May 2013", "Yes"],
        ["Deed of Donation of open spaces and roads", "15 May 2013", "Yes"],
        ["As-built plans (water, drainage, lighting)", "20 Aug 2013", "Yes"],
        ["List of turned-over common facilities", "20 Aug 2013", "Yes"],
      ],
    );
  },
  "membership-book.pdf": (p) => {
    frame(
      p,
      "Membership Book",
      "Updated master list of members, owners and authorized lessees (sample)",
    );
    const rows = [];
    for (let i = 1; i <= 14; i++)
      rows.push([
        `${1 + (i > 7 ? 1 : 0)}-${String(1 + (i % 4)).padStart(2, "0")}-${String(2 + i * 2).padStart(3, "0")}`,
        `Sample Member ${String(i).padStart(3, "0")}`,
        i % 5 === 0 ? "Authorized lessee" : "Owner",
        `${2013 + (i % 10)}`,
      ]);
    p.table(
      [
        { label: "Phase-Block-Lot", width: 110 },
        { label: "Name", width: 204 },
        { label: "Type", width: 120 },
        { label: "Member since", width: 70 },
      ],
      rows,
    );
    p.para(
      "Contact details are kept private and are not included in copies given to members.",
      { size: 9, color: MUTED },
    );
  },
  "election-reports.pdf": (p) => {
    frame(p, "Election Reports", "Election of 15 March 2026 (sample)");
    p.heading("Attendance and ballots");
    p.table(
      [
        { label: "Item", width: 344 },
        { label: "Count", width: 160, align: "right" },
      ],
      [
        ["Members who signed the attendance sheet", "448"],
        ["Proxies filed and validated", "38"],
        ["Ballots cast", "486"],
        ["Spoiled ballots", "6"],
      ],
    );
    p.heading("Documents in this report");
    p.bullets([
      "Attendance sheets (signed), 12 pages",
      "Notarized minutes of the election proceedings",
      "Certified election returns and tally sheets per precinct",
      "Election Committee certification of winners",
    ]);
    p.signature([
      ["Sample Chair", "Chair, Election Committee"],
      ["Sample Notary", "Notary Public (sample)"],
    ]);
  },
  "audited-financial-statements-and-annual-reports.pdf": (p) => {
    frame(
      p,
      "Audited Financial Statements and Annual Report",
      "For the year ended 31 December 2025 (sample)",
    );
    p.heading("Independent auditor's opinion (excerpt)");
    p.para(
      "In our opinion, the financial statements present fairly, in all material respects, the financial position of the Association as at 31 December 2025, in accordance with the Philippine Financial Reporting Standard for Small Entities. (Sample wording, Sample Auditing Firm.)",
      { size: 9.5 },
    );
    p.y -= 4;
    p.heading("Highlights");
    p.table(
      [
        { label: "Item", width: 344 },
        { label: "2025", width: 160, align: "right" },
      ],
      [
        ["Total income", peso(3172740)],
        ["Total expenses", peso(2914850)],
        ["Excess of income over expenses", peso(257890)],
        ["Members' equity at year end", peso(1363850)],
      ],
    );
    p.heading("Annual report");
    p.bullets([
      "Completed street light repairs in Phase 2 and the first stage of the drainage project.",
      "Collection rate for association dues: 89% (sample).",
      "Renewed the security services contract after a competitive canvass.",
    ]);
  },
  "books-of-accounts.pdf": (p) => {
    frame(
      p,
      "Books of Accounts",
      "Sample entries from the General Ledger, January 2026",
    );
    p.table(
      [
        { label: "Date", width: 70 },
        { label: "Account", width: 174 },
        { label: "Ref.", width: 60 },
        { label: "Debit", width: 100, align: "right" },
        { label: "Credit", width: 100, align: "right" },
      ],
      [
        ["05 Jan", "Cash in bank", "CR-001", peso(84500), ""],
        ["05 Jan", "Association dues", "CR-001", "", peso(84500)],
        ["10 Jan", "Security services", "CD-004", peso(110000), ""],
        ["10 Jan", "Cash in bank", "CD-004", "", peso(110000)],
        ["15 Jan", "Utilities expense", "CD-007", peso(38250), ""],
        ["15 Jan", "Cash in bank", "CD-007", "", peso(38250)],
        ["31 Jan", "Interest income", "JV-002", "", peso(1520)],
        ["31 Jan", "Cash in bank", "JV-002", peso(1520), ""],
      ],
      8.5,
    );
    p.para(
      "The Cash Receipts Book, Cash Disbursements Book, General Journal and General Ledger are kept at the HOA office.",
      { size: 9, color: MUTED },
    );
  },
  "supporting-financial-vouchers.pdf": (p) => {
    frame(
      p,
      "Supporting Financial Vouchers",
      "Voucher register, January 2026 (sample)",
    );
    p.table(
      [
        { label: "Voucher", width: 70 },
        { label: "Date", width: 64 },
        { label: "Payee", width: 160 },
        { label: "Support", width: 110 },
        { label: "Amount", width: 100, align: "right" },
      ],
      [
        [
          "CD-004",
          "10 Jan",
          "Sample Security Agency",
          "Invoice, contract",
          peso(110000),
        ],
        [
          "CD-005",
          "12 Jan",
          "Sample Hardware Supply",
          "Official receipt",
          peso(12480),
        ],
        [
          "CD-006",
          "14 Jan",
          "Sample Electric Co.",
          "Billing statement",
          peso(26300),
        ],
        [
          "CD-007",
          "15 Jan",
          "Sample Water District",
          "Billing statement",
          peso(11950),
        ],
        [
          "CD-008",
          "20 Jan",
          "Sample Landscaping",
          "Invoice, job order",
          peso(18000),
        ],
        [
          "CD-009",
          "28 Jan",
          "Sample Office Staff",
          "Payroll register",
          peso(45000),
        ],
      ],
      8.5,
    );
    p.para(
      "Bank statements and check stubs for January 2026 are filed with these vouchers (sample).",
      { size: 9, color: MUTED },
    );
  },
};

// ---- Assemble a one-page PDF with the logo image. ----
function build(file) {
  const page = new Page();
  docs[file](page);
  footer(page);
  const content = Buffer.from(page.ops.join("\n"), "latin1");
  const title = allDocs.find((d) => d.file === file).name;
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Logo 7 0 R >> >> /Contents 6 0 R >>`,
    ),
    Buffer.from(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ),
    Buffer.from(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ),
    Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`),
      content,
      Buffer.from("\nendstream"),
    ]),
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${logo.data.length} >>\nstream\n`,
      ),
      logo.data,
      Buffer.from("\nendstream"),
    ]),
    Buffer.from(
      `<< /Title (${esc(title)} - SAMPLE) /Producer (Bellefort portal sample generator) >>`,
    ),
  ];
  const parts = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  let size = parts[0].length;
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(size);
    const chunk = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      body,
      Buffer.from("\nendobj\n"),
    ]);
    parts.push(chunk);
    size += chunk.length;
  });
  const xref = [
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`,
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${size}\n%%EOF\n`,
  ].join("");
  parts.push(Buffer.from(xref));
  return Buffer.concat(parts);
}

for (const { file } of allDocs) {
  if (!docs[file]) throw new Error(`No sample content for ${file}`);
  writeFileSync(new URL(file, outDir), build(file));
  console.log("wrote", file);
}
