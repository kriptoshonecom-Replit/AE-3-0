import type jsPDF from "jspdf";

interface PolicySection {
  num: string;
  title: string;
  text: string;
}

const POLICY: PolicySection[] = [
  {
    num: "1",
    title: "Offer & Quote Validity",
    text: "All quotations and pricing information provided by NCR Voyix constitute general information sharing and are valid only when both parties have executed a binding agreement recognizing the specific terms, conditions, and pricing.",
  },
  {
    num: "2",
    title: "Price & Product Subject to Change",
    text: "Product specifications, availability, and prices may be modified without prior notice. NCR Voyix reserves the right to update pricing, features, and terms in accordance with market conditions and supplier requirements.",
  },
  {
    num: "3",
    title: "Agreement Between Parties",
    text: "A binding contract is formed only upon written acceptance by authorized representatives of both NCR Voyix and the customer. The acceptance must explicitly reference the quotation before any performance obligations arise.",
  },
  {
    num: "4",
    title: "Information Sharing Agreement",
    text: "Quotations and pricing information are provided as general offer information within an information sharing framework. Such information is provided as-is for informational purposes; neither party is bound until a formal written agreement is executed.",
  },
  {
    num: "5",
    title: "Terms & Conditions",
    text: "Any terms not addressed in a final written agreement are governed by NCR Voyix standard terms and conditions. In case of conflict between a quote and the standard terms, the written agreement signed by both parties shall take precedence.",
  },
  {
    num: "6",
    title: "Contact & Clarification",
    text: "For questions regarding quotations, pricing, or offer terms, contact NCR Voyix directly. Any modifications to quoted terms must be confirmed in writing by an authorized representative of NCR Voyix.",
  },
];

const LEFT_SECTIONS = POLICY.slice(0, 3);
const RIGHT_SECTIONS = POLICY.slice(3);

const TITLE_H = 3.2;
const LINE_H = 2.5;
const SECTION_GAP = 3.5;
const PAD = 5;
const TITLE_BAR_H = 6.5;
const CONTENT_LIMIT = 275;

function measureColumnHeight(doc: jsPDF, sections: PolicySection[], colTextWidth: number): number {
  let h = 0;
  for (const s of sections) {
    doc.setFontSize(7);
    const titleLines = doc.splitTextToSize(`${s.num}. ${s.title}`, colTextWidth) as string[];
    h += titleLines.length * TITLE_H + 1;
    doc.setFontSize(6.5);
    const bodyLines = doc.splitTextToSize(s.text, colTextWidth - 2) as string[];
    h += bodyLines.length * LINE_H;
    h += SECTION_GAP;
  }
  return h;
}

function drawColumn(
  doc: jsPDF,
  sections: PolicySection[],
  startX: number,
  startY: number,
  colTextWidth: number,
): void {
  let cy = startY;
  for (const s of sections) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    const titleLines = doc.splitTextToSize(`${s.num}. ${s.title}`, colTextWidth) as string[];
    doc.text(titleLines, startX, cy);
    cy += titleLines.length * TITLE_H + 1;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(80, 95, 115);
    const bodyLines = doc.splitTextToSize(s.text, colTextWidth - 2) as string[];
    doc.text(bodyLines, startX + 2, cy);
    cy += bodyLines.length * LINE_H + SECTION_GAP;
  }
}

export function addPolicySection(
  doc: jsPDF,
  yIn: number,
  pageWidth: number,
  margin: number,
  contentWidth: number,
): number {
  let y = yIn;

  const colGap = 7;
  const colWidth = (contentWidth - colGap) / 2;
  const colTextWidth = colWidth - 4;

  const leftH = measureColumnHeight(doc, LEFT_SECTIONS, colTextWidth);
  const rightH = measureColumnHeight(doc, RIGHT_SECTIONS, colTextWidth);
  const colH = Math.max(leftH, rightH);
  const totalH = TITLE_BAR_H + PAD + colH + PAD;

  if (y + totalH + 10 > CONTENT_LIMIT) {
    doc.addPage();
    y = margin;
  } else {
    y += 10;
  }

  // ── Title bar ──
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, TITLE_BAR_H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("NCR VOYIX — QUOTE AND OFFER POLICY", margin + 3, y + TITLE_BAR_H / 2 + 1.3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(180, 190, 210);
  doc.text("Document Version 1.0", margin + contentWidth - 3, y + TITLE_BAR_H / 2 + 1.2, { align: "right" });
  y += TITLE_BAR_H;

  // ── Content box ──
  const boxH = PAD + colH + PAD;
  doc.setFillColor(249, 250, 252);
  doc.rect(margin, y, contentWidth, boxH, "F");
  doc.setDrawColor(215, 220, 228);
  doc.setLineWidth(0.25);
  doc.rect(margin, y, contentWidth, boxH, "S");

  // Centre divider
  const divX = margin + colWidth + colGap / 2;
  doc.setDrawColor(215, 220, 228);
  doc.setLineWidth(0.2);
  doc.line(divX, y + PAD, divX, y + PAD + colH);

  // ── Columns ──
  const colStartY = y + PAD;
  drawColumn(doc, LEFT_SECTIONS, margin + 3, colStartY, colTextWidth);
  drawColumn(doc, RIGHT_SECTIONS, margin + colWidth + colGap + 1, colStartY, colTextWidth);

  y += boxH;

  return y;
}
