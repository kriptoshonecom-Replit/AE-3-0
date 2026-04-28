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
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status} ${src}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

export async function exportQuoteToPDF(
  quote: Quote,
  pitHourlyRate?: number,
  stampStatus?: "pass" | "fail" | null,
  pspmDiscountPct?: number,
  upfrontPriceDiscountPct?: number,
): Promise<void> {
  const rate = pitHourlyRate ?? PIT_HOURLY_RATE;
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

    // Pass / Fail badge — below app name in banner
    if (stampStatus === "pass" || stampStatus === "fail") {
      const isPass = stampStatus === "pass";
      const badgeLabel = isPass ? "PASS" : "FAIL";
      const badgeX = margin;
      const badgeW = 16;
      const badgeH = 5.5;
      const badgeY = logoTopY + logoHeightMm + 8.5;
      if (isPass) doc.setFillColor(34, 197, 94);
      else doc.setFillColor(239, 68, 68);
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(badgeLabel, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1.3, {
        align: "center",
      });
    }
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
        (s, i) => s + i.duration * rate,
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
    undefined,
    rate,
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
  row("Upfront Total", formatCurrency(pitTotal + productPitTotal), true);

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

  // ── Discount Analysis ───────────────────────────────
  if (pspmDiscountPct !== undefined || upfrontPriceDiscountPct !== undefined) {
    const fmtPct = (v: number) => `${v.toFixed(2)}%`;
    const rows: Array<[string, number]> = [];
    if (pspmDiscountPct !== undefined) rows.push(["PSPM Discount %", pspmDiscountPct]);
    if (upfrontPriceDiscountPct !== undefined) rows.push(["Upfront Price Discount %", upfrontPriceDiscountPct]);

    const blockH = 7 + rows.length * 7 + 4;
    addPageIfNeeded(blockH + 8);
    y += 8;

    // Section header bar
    doc.setFillColor(124, 58, 237);
    doc.rect(margin, y, contentWidth, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("DISCOUNT ANALYSIS", margin + 3, y + 4.2);
    y += 6;

    // Light background
    doc.setFillColor(250, 247, 255);
    doc.rect(margin, y, contentWidth, rows.length * 7 + 4, "F");
    doc.setDrawColor(220, 220, 218);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, rows.length * 7 + 4, "S");
    y += 5;

    for (const [label, value] of rows) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(label, margin + 4, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(124, 58, 237);
      doc.text(fmtPct(value), margin + contentWidth - 4, y, { align: "right" });
      y += 7;
    }
  }

  // ── Customer Request ─────────────────────────────────
  {
    const crRows: Array<[string, string]> = [
      ["One-Time Initial Payment", quote.meta.requestedUpfrontAmount || "—"],
      ["Monthly Pricing Per Site", quote.meta.requestedSubscriptionAmount || "—"],
    ];

    const blockH = 6 + crRows.length * 7 + 4;
    addPageIfNeeded(blockH + 8);
    y += 8;

    // Section header bar
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentWidth, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("CUSTOMER REQUEST", margin + 3, y + 4.2);
    y += 6;

    // Light background
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, crRows.length * 7 + 4, "F");
    doc.setDrawColor(220, 220, 218);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, crRows.length * 7 + 4, "S");
    y += 5;

    for (const [label, value] of crRows) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(label, margin + 4, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(value, margin + contentWidth - 4, y, { align: "right" });
      y += 7;
    }
  }

  // ── Helper: boxy item table (matches product group style) ──
  type TableRow = { name: string; qty: number; price: number };

  const drawItemsTable = (title: string, rows: TableRow[], showQty: boolean) => {
    if (rows.length === 0) return;
    const sectionTotal = rows.reduce((s, r) => s + r.price * r.qty, 0);

    addPageIfNeeded(20 + rows.length * 7);
    y += 6;

    // Header band
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 3, y + 4.5);
    doc.text(formatCurrency(sectionTotal), margin + contentWidth - 3, y + 4.5, { align: "right" });
    y += 7;

    // Column headers
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text("ITEM", margin + 3, y + 3.5);
    if (showQty) {
      doc.text("QTY", margin + 120, y + 3.5, { align: "right" });
    }
    doc.text("PRICE", margin + contentWidth - 3, y + 3.5, { align: "right" });
    y += 5;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    y += 0.5;

    // Rows
    for (const row of rows) {
      addPageIfNeeded(7);
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const label = row.name.length > 55 ? row.name.slice(0, 53) + "…" : row.name;
      doc.text(label, margin + 3, y + 3.5);
      if (showQty) {
        doc.text(String(row.qty), margin + 120, y + 3.5, { align: "right" });
      }
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(row.price * row.qty), margin + contentWidth - 3, y + 3.5, { align: "right" });
      y += 6;
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + contentWidth, y);
      y += 0.5;
    }
    y += 3;
  };

  // ── Heatmap & Cabling breakdown ─────────────────────
  const heatmapFullCat = (
    pitData.categories as Array<{
      id: string;
      lineItems: Array<{ id: string; name: string; price?: number }>;
    }>
  ).find((c) => c.id === "heatmap");

  const activeHeatmapRows: TableRow[] = (heatmapFullCat?.lineItems ?? [])
    .filter((i) => heatmapToggles[i.id])
    .map((i) => ({ name: i.name, qty: 1, price: i.price ?? 0 }));

  drawItemsTable("Heatmap & Cabling", activeHeatmapRows, false);

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
