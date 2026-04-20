import jsPDF from "jspdf";
import type { Quote, PitCategory } from "../types";
import {
  formatCurrency,
  groupSubtotal,
  quoteSubtotal,
  quoteDiscount,
  quoteTax,
  quoteTotal,
} from "./calculations";
import pitData from "../data/pit-services.json";
import { PIT_HOURLY_RATE } from "../data/pit-config";
import { computeLineItemTotal } from "./quoteLogic";
import { computeProductRelatedPitTotal } from "../components/ProductRelatedPitSection";

const DEFAULT_YES_NO: Record<string, boolean> = {
  "connected-payments-yn": false,
  "online-ordering-yn": false,
};

const DEFAULT_OPT_PROGRAMS: Record<string, boolean> = {
  "consumer-marketing": true,
  "insight-or-console": true,
  "aloha-api": true,
  kitchen: true,
  orderpay: true,
  "aloha-delivery": true,
};

const pitCategories = pitData.categories as PitCategory[];

const logoUrl = new URL("/logo.png", import.meta.url).href;

async function loadImageAsDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not available"));
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load logo"));
    img.src = src;
  });
}

export async function exportQuoteToPDF(quote: Quote): Promise<void> {
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

  // ── Header banner (light grey) ───────────────────────
  const bannerHeight = 38;
  doc.setFillColor(244, 244, 242);
  doc.rect(0, 0, pageWidth, bannerHeight, "F");

  // Subtle bottom border on banner
  doc.setDrawColor(220, 220, 218);
  doc.setLineWidth(0.4);
  doc.line(0, bannerHeight, pageWidth, bannerHeight);

  // Logo — load and embed
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

    // App name below the logo, left-aligned with logo
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 98);
    doc.text("Aloha Essential CPQ 3.0", margin, logoTopY + logoHeightMm + 4.5);

    // Created | Valid Until — right side of banner
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 118);
    const dateLine = `Created: ${quote.meta.createdAt}  |  Valid Until: ${quote.meta.validUntil}`;
    doc.text(dateLine, pageWidth - margin, logoTopY + logoHeightMm + 4.5, {
      align: "right",
    });
  } catch {
    // Fallback: just write app name if logo fails
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(124, 58, 237);
    doc.text("Aloha Essential CPQ 3.0", margin, bannerHeight / 2 + 2);
  }

  y = bannerHeight + 6;

  // ── Quote info (left) + Customer info (right) ───────
  const startY = y;
  const rightColX = pageWidth - margin;

  // Left: Quote Number, Opp #, Sales Rep (label + value pairs)
  const infoLabelColor: [number, number, number] = [100, 116, 139];
  const infoValueColor: [number, number, number] = [30, 41, 59];
  let leftY = startY;

  const leftRow = (label: string, value: string) => {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...infoLabelColor);
    doc.text(label, margin, leftY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...infoValueColor);
    doc.text(value, margin + 28, leftY);
    leftY += 5.5;
  };

  if (quote.meta.quoteNumber) leftRow("Quote Number:", quote.meta.quoteNumber);
  if (quote.meta.oppNumber) leftRow("Opp Number:", quote.meta.oppNumber);
  if (quote.meta.salesRep) leftRow("Sales Rep:", quote.meta.salesRep);

  // Right: Company Name, Customer Name, Customer Email
  // Labels at mid-page, values right-aligned — wide enough to never overlap
  const rightLabelStart = pageWidth / 2 + 5;
  let rightY = startY;

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

  if (quote.meta.companyName)
    rightRow("Company Name:", quote.meta.companyName, true);
  if (quote.meta.customerName)
    rightRow("Customer Name:", quote.meta.customerName);
  if (quote.meta.customerEmail)
    rightRow("Customer Email:", quote.meta.customerEmail);

  y = Math.max(leftY, rightY) + 4;

  // ── Groups ──────────────────────────────────────────
  for (const group of quote.groups) {
    if (group.lineItems.length === 0) continue;

    addPageIfNeeded(20);

    // Group header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(group.categoryName, margin + 3, y + 4.5);
    doc.text(
      formatCurrency(groupSubtotal(group)),
      margin + contentWidth - 3,
      y + 4.5,
      { align: "right" },
    );
    y += 7;

    // Column headers
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text("ITEM", margin + 3, y + 3.5);
    doc.text("QTY", margin + 120, y + 3.5, { align: "right" });
    doc.text("UNIT PRICE", margin + 155, y + 3.5, { align: "right" });
    doc.text("TOTAL", margin + contentWidth - 3, y + 3.5, { align: "right" });
    y += 5;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    y += 0.5;

    // Line items
    for (const item of group.lineItems) {
      addPageIfNeeded(7);
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");

      const name =
        item.productName.length > 52
          ? item.productName.slice(0, 50) + "…"
          : item.productName;
      doc.text(name, margin + 3, y + 3.5);
      doc.setTextColor(30, 41, 59);
      doc.text(String(item.quantity), margin + 120, y + 3.5, {
        align: "right",
      });
      doc.text(formatCurrency(item.unitPrice), margin + 155, y + 3.5, {
        align: "right",
      });
      doc.setFont("helvetica", "bold");
      doc.text(
        formatCurrency(
          computeLineItemTotal(item.productId, item.unitPrice, item.quantity),
        ),
        margin + contentWidth - 3,
        y + 3.5,
        { align: "right" },
      );

      if (item.note) {
        y += 5;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`  Note: ${item.note}`, margin + 3, y + 2);
      }

      y += 6;
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + contentWidth, y);
      y += 0.5;
    }

    y += 3;
  }

  // ── Totals ──────────────────────────────────────────
  addPageIfNeeded(56);
  y += 4;

  const totalsX = margin + contentWidth - 70;
  const labelX = totalsX;
  const valueX = margin + contentWidth - 3;

  // Compute PIT amounts
  const pitCatForTotal = pitCategories.find(
    (c) => c.id === (quote.meta.pitType ?? ""),
  );
  const pitTotal = pitCatForTotal
    ? pitCatForTotal.lineItems.reduce(
        (s, i) => s + i.duration * PIT_HOURLY_RATE,
        0,
      )
    : 0;
  const yesNoToggles = {
    ...DEFAULT_YES_NO,
    ...(quote.meta.yesNoToggles ?? {}),
  };
  const optToggles = {
    ...DEFAULT_OPT_PROGRAMS,
    ...(quote.meta.optionalProgramToggles ?? {}),
  };
  const productPitTotal = computeProductRelatedPitTotal(
    quote.groups,
    yesNoToggles,
    optToggles,
    quote.meta.pitType ?? "",
  );
  const heatmapItems =
    (
      pitCategories as Array<{
        id: string;
        lineItems: Array<{ id: string; price?: number }>;
      }>
    ).find((c) => c.id === "heatmap")?.lineItems ?? [];
  const heatmapToggles = quote.meta.heatmapToggles ?? {};
  const heatmapTotal = heatmapItems.reduce(
    (s, i) => s + (heatmapToggles[i.id] ? (i.price ?? 0) : 0),
    0,
  );
  const mrrTotal = quoteTotal(quote);
  const grandTotal = mrrTotal + pitTotal + productPitTotal;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const row = (
    label: string,
    value: string,
    bold = false,
    labelColor: [number, number, number] = [100, 116, 139],
  ) => {
    addPageIfNeeded(8);
    doc.setTextColor(...labelColor);
    if (bold) doc.setFont("helvetica", "bold");
    else doc.setFont("helvetica", "normal");
    doc.text(label, labelX, y);
    doc.setTextColor(15, 23, 42);
    doc.text(value, valueX, y, { align: "right" });
    y += 6;
  };

  row("Subtotal", formatCurrency(quoteSubtotal(quote)));
  if (quote.meta.discount > 0) {
    row(
      `Discount (${quote.meta.discount}%)`,
      `- ${formatCurrency(quoteDiscount(quote))}`,
      true,
      [34, 197, 94],
    );
  }
  if (quote.meta.tax > 0) {
    row(`Tax (${quote.meta.tax}%)`, formatCurrency(quoteTax(quote)));
  }

  // MRR Total divider line + bold row
  y += 1;
  doc.setDrawColor(220, 220, 218);
  doc.setLineWidth(0.3);
  doc.line(totalsX - 5, y - 1, margin + contentWidth, y - 1);
  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("MRR Total", labelX, y);
  doc.text(formatCurrency(mrrTotal), valueX, y, { align: "right" });
  y += 8;

  if (pitTotal > 0) {
    doc.setFont("helvetica", "normal");
    row("PIT", formatCurrency(pitTotal));
  }
  if (productPitTotal > 0) {
    doc.setFont("helvetica", "normal");
    row("Product Related PIT", formatCurrency(productPitTotal));
  }

  doc.setDrawColor(124, 58, 237);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 5, y - 1, margin + contentWidth, y - 1);
  y += 3;

  doc.setFontSize(11);
  row("Total", formatCurrency(grandTotal), true);

  if (heatmapTotal > 0) {
    y += 2;
    doc.setDrawColor(220, 220, 218);
    doc.setLineWidth(0.3);
    doc.line(totalsX - 5, y - 1, margin + contentWidth, y - 1);
    y += 3;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    row("Heatmap & Cabling", formatCurrency(heatmapTotal));
  }

  const buyoutAmount =
    parseFloat((quote.meta.costOfBuyOut ?? "").replace(/[^0-9.]/g, "")) || 0;
  if (buyoutAmount > 0) {
    y += 2;
    doc.setDrawColor(220, 220, 218);
    doc.setLineWidth(0.3);
    doc.line(totalsX - 5, y - 1, margin + contentWidth, y - 1);
    y += 3;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    row("Cost of BuyOut", formatCurrency(buyoutAmount));
  }

  const legacyToggles = quote.meta.legacyToggles ?? {};
  const legacyQuantities = quote.meta.legacyQuantities ?? {};
  const legacyItems: Array<{ id: string; price: number }> = [
    { id: "boh-001", price: 85 },
    { id: "fox-001", price: 70 },
    { id: "fox-002", price: 75 },
    { id: "km-001", price: 14 },
    { id: "boh-002", price: 5 },
    { id: "xl-001", price: 25 },
    { id: "pay-001", price: 35 },
    { id: "pay-002", price: 2 },
  ];
  const legacyTotal = legacyItems.reduce(
    (s, i) => s + (legacyToggles[i.id] ? i.price * (legacyQuantities[i.id] ?? 1) : 0),
    0,
  );
  if (legacyTotal > 0) {
    y += 2;
    doc.setDrawColor(220, 220, 218);
    doc.setLineWidth(0.3);
    doc.line(totalsX - 5, y - 1, margin + contentWidth, y - 1);
    y += 3;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    row("Legacy HW Added", formatCurrency(legacyTotal));
  }

  // ── Notes ──────────────────────────────────────────
  if (quote.meta.notes) {
    const noteLines = doc.splitTextToSize(quote.meta.notes, contentWidth - 10);
    const notePad = 5;
    const noteBoxHeight = notePad + 5 + noteLines.length * 5 + notePad;
    addPageIfNeeded(noteBoxHeight + 8);
    y += 8;

    // Grey background box
    doc.setFillColor(244, 244, 242);
    doc.rect(margin, y, contentWidth, noteBoxHeight, "F");
    doc.setDrawColor(220, 220, 218);
    doc.setLineWidth(0.4);
    doc.rect(margin, y, contentWidth, noteBoxHeight, "S");

    y += notePad;

    // Label
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 118);
    doc.text("NOTES", margin + notePad, y + 1);
    y += 5;

    // Note text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(noteLines, margin + notePad, y + 1);
    y += noteLines.length * 5 + notePad;
  }

  // ── Footer ──────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, 292, {
      align: "center",
    });
  }

  const filename = `${(quote.meta.quoteNumber || "quote").replace(/\s+/g, "-").toLowerCase()}.pdf`;
  doc.save(filename);
}
