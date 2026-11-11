import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { fmtDateTime, type Rec } from "./records";
import { VOLT_MAX_V, VOLT_MIN_V, VOLT_PASS_MIN_V, voltOk } from "./config";

const BLUE = rgb(0.18, 0.42, 0.16); // green table header
const GREEN = rgb(0.1, 0.6, 0.3);
const RED = rgb(0.78, 0.15, 0.15);
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 595.32;
const MARGIN = 48; // left margin
const MARGIN_R = 28; // right margin
const CONTENT_W = PAGE_W - MARGIN - MARGIN_R;
const TOP = 150; // space reserved for the letterhead header (pt from top)
const ROW_H = 20;

type Cell = { text: string; color?: ReturnType<typeof rgb>; bold?: boolean };

export async function buildReport(r: Rec): Promise<Uint8Array> {
  const template = await readFile(path.join(process.cwd(), "assets", "letter_head.pdf"));
  const doc = await PDFDocument.create();
  const [bg] = await doc.embedPdf(template, [0]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([bg.width, bg.height]);
  page.drawPage(bg);
  let y = page.getHeight() - TOP;

  // Title: centered, bold, underlined, no background
  const title = "POWER MUX INSPECTION TESTING REPORT";
  const titleSize = 14;
  const tw = bold.widthOfTextAtSize(title, titleSize);
  const tx = MARGIN + (CONTENT_W - tw) / 2;
  page.drawText(title, { x: tx, y: y - 14, size: titleSize, font: bold, color: BLACK });
  page.drawLine({
    start: { x: tx, y: y - 18 },
    end: { x: tx + tw, y: y - 18 },
    thickness: 1.2,
    color: BLACK,
  });
  y -= 18 + 26;

  const status = (ok: boolean): Cell => ({ text: ok ? "PASS" : "FAIL", color: ok ? GREEN : RED, bold: true });

  y = section(page, bold, "1. General Information", y);
  y = table(page, font, bold, y, [CONTENT_W * 0.35, CONTENT_W * 0.65], ["PARAMETER", "VALUE"], [
    [{ text: "Serial No" }, { text: r.sno }],
    [{ text: "Tested By" }, { text: r.testby ?? "-" }],
    [{ text: "Approved By" }, { text: r.appby ?? "-" }],
    [{ text: "Test Date (IST)" }, { text: fmtDateTime(r.created_at) }],
    [{ text: "Delay (s)" }, { text: (r.delay / 1000).toFixed(2) }],
    [{ text: "Overall Status" }, status(r.pass)],
  ], "center-right");
  y -= 22;

  y = section(page, bold, "2. SSR Channel Status", y);
  y = table(page, font, bold, y, [CONTENT_W * 0.6, CONTENT_W * 0.4], ["CHANNEL", "STATUS"], [
    [{ text: "SSR 1 TRIGGERING" }, status(r.ssr_1 === 1)],
    [{ text: "SSR 2 TRIGGERING" }, status(r.ssr_2 === 1)],
    [{ text: "SSR 3 TRIGGERING" }, status(r.ssr_3 === 1)],
    [{ text: "SSR 4 TRIGGERING" }, status(r.ssr_4 === 1)],
  ], "center-all");
  y -= 22;

  y = section(page, bold, "3. Voltage Parameters", y);
  y = table(page, font, bold, y, [CONTENT_W * 0.4, CONTENT_W * 0.3, CONTENT_W * 0.3], ["PARAMETER", "VALUE (V)", "STATUS"], [
    [{ text: "VoutM" }, { text: (r.voutm / 1000).toFixed(2) }, status(voltOk(r.voutm))],
    [{ text: "VoutA" }, { text: (r.vout_a / 1000).toFixed(2) }, status(voltOk(r.vout_a))],
  ], "center-all");
  page.drawText(`Valid range ${VOLT_MIN_V} to ${VOLT_MAX_V} V. Minimum pass voltage: ${VOLT_PASS_MIN_V} V.`, {
    x: MARGIN, y: y - 14, size: 8, font, color: BLACK,
  });

  const foot = `Page 1/1`;
  page.drawText(foot, {
    x: (PAGE_W - font.widthOfTextAtSize(foot, 7)) / 2, y: 22, size: 7, font, color: BLACK,
  });

  return doc.save();
}

function section(page: PDFPage, bold: PDFFont, text: string, y: number) {
  page.drawText(text, { x: MARGIN, y: y - 12, size: 12, font: bold, color: BLACK });
  return y - 12 - 10;
}

function table(
  page: PDFPage, font: PDFFont, bold: PDFFont, top: number,
  widths: number[], head: string[], rows: Cell[][], align: "center-right" | "center-all"
) {
  let x = MARGIN;
  let y = top;
  // header row
  head.forEach((h, i) => {
    page.drawRectangle({ x, y: y - ROW_H, width: widths[i], height: ROW_H, color: BLUE, borderColor: BLACK, borderWidth: 0.8 });
    const w = bold.widthOfTextAtSize(h, 9);
    page.drawText(h, { x: x + (widths[i] - w) / 2, y: y - 13.5, size: 9, font: bold, color: WHITE });
    x += widths[i];
  });
  y -= ROW_H;
  for (const row of rows) {
    x = MARGIN;
    row.forEach((c, i) => {
      page.drawRectangle({ x, y: y - ROW_H, width: widths[i], height: ROW_H, borderColor: BLACK, borderWidth: 0.8 });
      const f = c.bold ? bold : font;
      const w = f.widthOfTextAtSize(c.text, 9);
      const centered = i === 1 || align === "center-all" && i > 0;
      page.drawText(c.text, {
        x: centered ? x + (widths[i] - w) / 2 : x + 5,
        y: y - 13.5, size: 9, font: f, color: c.color ?? BLACK,
      });
      x += widths[i];
    });
    y -= ROW_H;
  }
  return y;
}
