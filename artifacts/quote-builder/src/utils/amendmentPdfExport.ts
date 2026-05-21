import jsPDF from "jspdf";
import { formatCurrency } from "./calculations";

const logoUrl = new URL("/logo.png", import.meta.url).href;

async function loadImageAsDataUrl(src: string): Promise<string> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

interface DeltaLineItem {
  productId: string;
  productName: string;
  unitPrice: number;
  originalQty: number;
  amendedQty: number;
  delta: number;
  deltaValue: number;
}

interface DeltaGroup {
  categoryId: string;
  categoryName: string;
  lineItems: DeltaLineItem[];
}

export interface AmendmentExportData {
  amendmentNumber: number;
  quoteNumber: string | null;
  originalQuoteNumber: string | null;
  companyName: string | null;
  customerName: string | null;
  createdAt: string;
  deltaGroups: DeltaGroup[];
  subtotalDelta: number;
  mrrDelta: number;
  discount?: number;
  tax?: number;
  notes?: string;
}

export async function exportAmendmentToPDF(data: AmendmentExportData): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > 275) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Banner ───────────────────────────────────────────
  const bannerHeight = 38;
  doc.setFillColor(244, 244, 242);
  doc.rect(0, 0, pageWidth, bannerHeight, "F");
  doc.setDrawColor(220, 220, 218);
  doc.setLineWidth(0.4);
  doc.line(0, bannerHeight, pageWidth, bannerHeight);

  try {
    const logoData = await loadImageAsDataUrl(logoUrl);
    const logoHeightMm = 10;
    const tempImg = new Image();
    await new Promise<void>((res) => {
      tempImg.onload = () => res();
      tempImg.src = logoUrl;
    });
    const aspectRatio = tempImg.naturalWidth / tempImg.naturalHeight;
    const logoWidthMm = logoHeightMm * aspectRatio;
    const logoTopY = 7;
    doc.addImage(logoData, "PNG", margin, logoTopY, logoWidthMm, logoHeightMm);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 98);
    doc.text("Aloha Essential CPQ 3.0", margin, logoTopY + logoHeightMm + 4.5);

    // Amendment label pill
    const pillX = margin;
    const pillY = logoTopY + logoHeightMm + 8.5;
    const pillW = 26;
    const pillH = 5.5;
    doc.setFillColor(124, 58, 237);
    doc.roundedRect(pillX, pillY, pillW, pillH, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text("AMENDMENT", pillX + pillW / 2, pillY + pillH / 2 + 1.2, { align: "center" });

    // Date on the right
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 118);
    doc.setFontSize(7.5);
    const dateStr = (() => {
      const d = new Date(data.createdAt);
      if (isNaN(d.getTime())) return data.createdAt;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    })();
    doc.text(`Created: ${dateStr}`, pageWidth - margin, logoTopY + logoHeightMm + 4.5, { align: "right" });
  } catch {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(124, 58, 237);
    doc.text("Aloha Essential CPQ 3.0 — Amendment", margin, bannerHeight / 2 + 2);
  }

  y = bannerHeight + 6;

  // ── Info section ─────────────────────────────────────
  const infoLabelColor: [number, number, number] = [100, 116, 139];
  const infoValueColor: [number, number, number] = [30, 41, 59];
  const startY = y;
  let leftY = startY;
  let rightY = startY;
  const rightColX = pageWidth - margin;
  const rightLabelStart = pageWidth / 2 + 5;

  const leftRow = (label: string, value: string) => {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...infoLabelColor);
    doc.text(label, margin, leftY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...infoValueColor);
    doc.text(value, margin + 38, leftY);
    leftY += 5.5;
  };

  const rightRow = (label: string, value: string, bold = false) => {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...infoLabelColor);
    doc.text(label, rightLabelStart, rightY);
    doc.setFontSize(9);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...infoValueColor);
    doc.text(value, rightColX, rightY, { align: "right" });
    rightY += 5.5;
  };

  const amendNumStr = `Amend ${String(data.amendmentNumber).padStart(3, "0")}`;
  leftRow("Amendment #:", amendNumStr);
  if (data.quoteNumber) leftRow("Amendment Quote #:", data.quoteNumber);
  if (data.originalQuoteNumber) leftRow("Original Quote #:", data.originalQuoteNumber);

  if (data.companyName) rightRow("Company:", data.companyName, true);
  if (data.customerName) rightRow("Customer:", data.customerName);
  if (data.discount && data.discount > 0) rightRow("Discount:", `${data.discount}%`);
  if (data.tax && data.tax > 0) rightRow("Tax:", `${data.tax}%`);

  y = Math.max(leftY, rightY) + 6;

  // Divider
  doc.setDrawColor(220, 220, 218);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  // ── Changed line items by group ───────────────────────
  const changedGroups = data.deltaGroups
    .map((g) => ({ ...g, lineItems: g.lineItems.filter((li) => li.delta !== 0) }))
    .filter((g) => g.lineItems.length > 0);

  for (const group of changedGroups) {
    addPageIfNeeded(22 + group.lineItems.length * 8);

    // Group header band
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(group.categoryName, margin + 3, y + 4.5);

    // Group delta total
    const groupDelta = group.lineItems.reduce((s, li) => s + li.deltaValue, 0);
    const deltaColor: [number, number, number] = groupDelta > 0 ? [21, 128, 61] : groupDelta < 0 ? [185, 28, 28] : [100, 116, 139];
    doc.setTextColor(...deltaColor);
    doc.text(
      (groupDelta > 0 ? "+" : "") + formatCurrency(groupDelta),
      margin + contentWidth - 3,
      y + 4.5,
      { align: "right" },
    );
    y += 7;

    // Column x positions (all right-aligned except ITEM)
    const colOrigQty   = margin + 80;
    const colNewQty    = margin + 103;
    const colChange    = margin + 122;
    const colUnitPrice = margin + 150;
    const colDelta     = margin + contentWidth - 3;

    // Column headers
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text("ITEM",        margin + 3,   y + 3.5);
    doc.text("ORIG QTY",   colOrigQty,   y + 3.5, { align: "right" });
    doc.text("NEW QTY",    colNewQty,    y + 3.5, { align: "right" });
    doc.text("CHANGE",     colChange,    y + 3.5, { align: "right" });
    doc.text("UNIT PRICE", colUnitPrice, y + 3.5, { align: "right" });
    doc.text("DELTA VALUE",colDelta,     y + 3.5, { align: "right" });
    y += 5;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    y += 0.5;

    for (const li of group.lineItems) {
      addPageIfNeeded(8);
      const isPos = li.delta > 0;
      const deltaTextColor: [number, number, number] = isPos ? [21, 128, 61] : [185, 28, 28];
      const deltaSign = isPos ? "+" : "";

      // Subtle row background for changed items
      if (isPos) {
        doc.setFillColor(240, 253, 244);
      } else {
        doc.setFillColor(254, 242, 242);
      }
      doc.rect(margin, y, contentWidth, 6.5, "F");

      // Product name (truncate to ~45 chars to stay clear of numeric cols)
      const name =
        li.productName.length > 40
          ? li.productName.slice(0, 38) + "…"
          : li.productName;
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(name, margin + 3, y + 4);

      // Orig qty
      doc.setTextColor(100, 116, 139);
      doc.text(String(li.originalQty), colOrigQty, y + 4, { align: "right" });

      // New qty (bold, colored)
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...deltaTextColor);
      doc.text(String(li.amendedQty), colNewQty, y + 4, { align: "right" });

      // Change
      doc.setTextColor(...deltaTextColor);
      doc.text(`${deltaSign}${li.delta}`, colChange, y + 4, { align: "right" });

      // Unit price
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(formatCurrency(li.unitPrice), colUnitPrice, y + 4, { align: "right" });

      // Delta value (bold, colored)
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...deltaTextColor);
      doc.text(
        `${deltaSign}${formatCurrency(li.deltaValue)}`,
        colDelta,
        y + 4,
        { align: "right" },
      );

      y += 6.5;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + contentWidth, y);
      y += 0.5;
    }

    y += 4;
  }

  // ── Delta totals summary ──────────────────────────────
  addPageIfNeeded(36);
  y += 4;

  const totalsX = margin + contentWidth - 75;
  const valueX = margin + contentWidth - 3;

  const deltaRow = (label: string, value: number, bold = false) => {
    const color: [number, number, number] =
      value > 0 ? [21, 128, 61] : value < 0 ? [185, 28, 28] : [100, 116, 139];
    const sign = value > 0 ? "+" : "";
    doc.setFontSize(9);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(label, totalsX, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(
      value === 0 ? "—" : `${sign}${formatCurrency(value)}`,
      valueX,
      y,
      { align: "right" },
    );
    y += 6;
  };

  deltaRow("Subtotal Delta", data.subtotalDelta);

  if (data.discount && data.discount > 0) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`After discount (${data.discount}%)`, totalsX, y);
    const afterDiscount = data.subtotalDelta * (1 - data.discount / 100);
    const sign = afterDiscount > 0 ? "+" : "";
    const color: [number, number, number] =
      afterDiscount > 0 ? [21, 128, 61] : afterDiscount < 0 ? [185, 28, 28] : [100, 116, 139];
    doc.setTextColor(...color);
    doc.setFont("helvetica", "bold");
    doc.text(
      afterDiscount === 0 ? "—" : `${sign}${formatCurrency(afterDiscount)}`,
      valueX,
      y,
      { align: "right" },
    );
    y += 6;
  }

  // MRR Delta — accent line + bold row
  y += 1;
  doc.setDrawColor(124, 58, 237);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 5, y - 1, margin + contentWidth, y - 1);
  y += 3;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("MRR Delta", totalsX, y);
  const mrrColor: [number, number, number] =
    data.mrrDelta > 0 ? [21, 128, 61] : data.mrrDelta < 0 ? [185, 28, 28] : [100, 116, 139];
  const mrrSign = data.mrrDelta > 0 ? "+" : "";
  doc.setTextColor(...mrrColor);
  doc.text(
    data.mrrDelta === 0 ? "—" : `${mrrSign}${formatCurrency(data.mrrDelta)}`,
    valueX,
    y,
    { align: "right" },
  );
  y += 8;

  // ── Notes ───────────────────────────────────────────
  if (data.notes) {
    const noteLines = doc.splitTextToSize(data.notes, contentWidth - 10);
    const notePad = 5;
    const noteBoxHeight = notePad + 5 + noteLines.length * 5 + notePad;
    addPageIfNeeded(noteBoxHeight + 8);
    y += 4;

    doc.setFillColor(244, 244, 242);
    doc.rect(margin, y, contentWidth, noteBoxHeight, "F");
    doc.setDrawColor(220, 220, 218);
    doc.setLineWidth(0.4);
    doc.rect(margin, y, contentWidth, noteBoxHeight, "S");

    y += notePad;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 118);
    doc.text("NOTES", margin + notePad, y + 1);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(noteLines, margin + notePad, y + 1);
  }

  // ── Save ────────────────────────────────────────────
  const safeName = (data.quoteNumber || `Amend_${String(data.amendmentNumber).padStart(3, "0")}`).replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`${safeName}.pdf`);
}
