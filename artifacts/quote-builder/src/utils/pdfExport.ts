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
import { computeProductRelatedPitTotal, computeProductRelatedPitHours } from "../components/ProductRelatedPitSection";
import { addPolicySection } from "./pdfPolicy";

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

/** Load an image, scale it down, and re-encode as PNG to minimise PDF size. */
async function loadLogoAsPng(
  src: string,
  maxWidth = 600,
): Promise<{ dataUrl: string; naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { naturalWidth, naturalHeight } = img;
      const scale = Math.min(1, maxWidth / naturalWidth);
      const w = Math.round(naturalWidth * scale);
      const h = Math.round(naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas 2d context unavailable")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve({ dataUrl: canvas.toDataURL("image/png"), naturalWidth, naturalHeight });
    };
    img.onerror = () => reject(new Error(`Image load failed: ${src}`));
    img.src = src;
  });
}

export async function exportQuoteToPDF(
  quote: Quote,
  pitHourlyRate?: number,
  stampStatus?: "pass" | "fail" | null,
  pspmDiscountPct?: number,
  upfrontPriceDiscountPct?: number,
  voyixTxnFee?: number,
  gatewayTxnRate?: number,
  tieredAdditionalPrice?: number,
  appVersion?: string,
  mode?: "download" | "base64",
): Promise<string | undefined> {
  const rate = pitHourlyRate ?? PIT_HOURLY_RATE;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
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

  // Logo — load, downscale, and embed as PNG to keep PDF size small
  try {
    const logo = await loadLogoAsPng(logoUrl);
    const logoHeightMm = 10;
    const aspectRatio = logo.naturalWidth / logo.naturalHeight;
    const logoWidthMm = logoHeightMm * aspectRatio;
    const logoTopY = 7;
    doc.addImage(logo.dataUrl, "PNG", margin, logoTopY, logoWidthMm, logoHeightMm);

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
  if (quote.meta.mcn) leftRow("MCN:", quote.meta.mcn);
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

  // ── Business Operation Address — right column, below customer info ──
  const addrLine = quote.meta.addressLine || [
    [quote.meta.addressNumber, quote.meta.addressName].filter(Boolean).join(" "),
    quote.meta.addressCity,
    [quote.meta.addressState, quote.meta.zipCode].filter(Boolean).join(", "),
    quote.meta.addressCountry,
  ].filter(Boolean).join(", ");

  if (addrLine) {
    rightY += 1.5;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(150, 150, 148);
    doc.text("BUSINESS ADDRESS", rightLabelStart, rightY);
    rightY += 4;

    const colW = rightColX - rightLabelStart - 2;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...infoValueColor);
    const addrWrapped = doc.splitTextToSize(addrLine, colW) as string[];
    for (const ln of addrWrapped) {
      doc.text(ln, rightColX, rightY, { align: "right" });
      rightY += 5;
    }
  }

  const parseCrAmt = (v?: string) => {
    const n = parseFloat((v ?? "").replace(/[^0-9.]/g, ""));
    return n > 0 ? formatCurrency(n) : null;
  };
  const crUpfront = parseCrAmt(quote.meta.requestedUpfrontAmount);
  const crMonthly = parseCrAmt(quote.meta.requestedSubscriptionAmount);

  // Styled highlight boxes — same bg as group headers, text matches pass/fail (darker)
  const hlColor: [number, number, number] =
    stampStatus === "pass" ? [21, 128, 61] :
    stampStatus === "fail" ? [185, 28, 28] :
    [30, 41, 59];

  const crBoxW = rightColX - rightLabelStart;
  const crBoxH = 7.5;

  const drawCrBox = (label: string, value: string) => {
    rightY += 1.5;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(rightLabelStart, rightY, crBoxW, crBoxH, 1, 1, "F");
    doc.setDrawColor(200, 210, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(rightLabelStart, rightY, crBoxW, crBoxH, 1, 1, "S");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 100, 120);
    doc.text(label, rightLabelStart + 3, rightY + crBoxH / 2 + 1.2);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...hlColor);
    doc.text(value, rightColX - 3, rightY + crBoxH / 2 + 1.2, { align: "right" });
    rightY += crBoxH + 2;
  };

  if (crUpfront) drawCrBox("Requested One-Time Payment", crUpfront);
  if (crMonthly) drawCrBox("Requested Monthly/Site", crMonthly);

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
          computeLineItemTotal(item.productId, item.unitPrice, item.quantity, tieredAdditionalPrice),
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
  const pitHours = pitCatForTotal
    ? pitCatForTotal.lineItems.reduce((s, i) => s + i.duration, 0)
    : 0;
  const productPitHours = computeProductRelatedPitHours(
    quote.groups,
    yesNoToggles,
    optToggles,
    quote.meta.pitType ?? "",
  );
  const recurringPit = quote.meta.recurringPit ?? false;
  const upfrontDisplayValue = recurringPit
    ? (pitHours + productPitHours) * 4
    : pitTotal + productPitTotal;
  const totalPitHours = pitHours + productPitHours;
  const upfrontBaseLabel = recurringPit ? "Monthly Upfront Total" : "Upfront Total";
  const upfrontLabel = totalPitHours > 0 ? `${upfrontBaseLabel} (${totalPitHours} hrs)` : upfrontBaseLabel;
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

  doc.setFontSize(9);
  row(upfrontLabel, formatCurrency(upfrontDisplayValue), true);

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
    const parseCr = (v?: string) => {
      const n = parseFloat((v ?? "").replace(/[^0-9.]/g, ""));
      return n > 0 ? formatCurrency(n) : "—";
    };
    const crRows: Array<[string, string]> = [
      ["One-Time Initial Payment", parseCr(quote.meta.requestedUpfrontAmount)],
      ["Monthly Pricing Per Site", parseCr(quote.meta.requestedSubscriptionAmount)],
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

  // ── Payments Overview ────────────────────────────────
  if (voyixTxnFee !== undefined || gatewayTxnRate !== undefined) {
    const fmtRate = (v: number) => v > 0 ? `$${v.toFixed(4)}` : "—";
    const poRows: Array<[string, string, boolean]> = [];
    if (voyixTxnFee !== undefined)
      poRows.push(["Payments Processing Txn Rate", fmtRate(voyixTxnFee), false]);
    if (gatewayTxnRate !== undefined)
      poRows.push(["Gateway Payments Txn Rate", fmtRate(gatewayTxnRate), false]);
    if (voyixTxnFee !== undefined && gatewayTxnRate !== undefined) {
      const total = voyixTxnFee + gatewayTxnRate;
      poRows.push(["Total Txn Rate", total > 0 ? `$${total.toFixed(4)}` : "—", true]);
    }

    const hasTotalRow = poRows.some(([,, t]) => t);
    const bodyH = poRows.length * 7 + 4 + (hasTotalRow ? 6 : 0);
    const blockH = 6 + bodyH;
    addPageIfNeeded(blockH + 8);
    y += 8;

    // Section header bar — teal/slate
    doc.setFillColor(2, 132, 199);
    doc.rect(margin, y, contentWidth, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("PAYMENTS OVERVIEW", margin + 3, y + 4.2);
    y += 6;

    // Light background
    doc.setFillColor(240, 249, 255);
    doc.rect(margin, y, contentWidth, bodyH, "F");
    doc.setDrawColor(220, 220, 218);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, bodyH, "S");
    y += 5;

    for (const [label, value, isTotalRow] of poRows) {
      if (isTotalRow) {
        y += 6;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(margin + 3, y - 4, margin + contentWidth - 3, y - 4);
      }
      doc.setFont("helvetica", isTotalRow ? "bold" : "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(label, margin + 4, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(2, 132, 199);
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

  // ── Policy section ──────────────────────────────────
  y = addPolicySection(doc, y, pageWidth, margin, contentWidth);

  // ── Footer ──────────────────────────────────────────
  const sameForBilling = quote.meta.sameForBilling !== false; // default true

  // Support both new single-line field and old individual fields (backwards compat)
  const billingOneLiner = !sameForBilling
    ? (quote.meta.billingAddressLine ||
       [
         [quote.meta.billingAddressNumber, quote.meta.billingAddressName].filter(Boolean).join(" "),
         quote.meta.billingAddressCity,
         [quote.meta.billingAddressState, quote.meta.billingZipCode].filter(Boolean).join(" "),
         quote.meta.billingAddressCountry,
       ].filter(Boolean).join(", "))
    : "";

  const hasBillingAddr = !sameForBilling && !!billingOneLiner;

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Billing address footer strip
    if (hasBillingAddr && billingOneLiner) {
      // Thin separator line
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, 279, pageWidth - margin, 279);

      // Label
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(160, 160, 160);
      doc.text("BILLING ADDRESS", margin, 283.5);

      // Address text
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(billingOneLiner, margin + 28, 283.5);
    }

    // Page number (centred) + version (right)
    const pageNumY = hasBillingAddr ? 289 : 292;
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageNumY, {
      align: "center",
    });
    if (appVersion) {
      doc.setFontSize(6.5);
      doc.setTextColor(200, 200, 200);
      doc.text(`Version Build ${appVersion}`, pageWidth - margin, pageNumY, {
        align: "right",
      });
    }
  }

  const filename = `${(quote.meta.quoteNumber || "quote").replace(/\s+/g, "-").toLowerCase()}.pdf`;
  if (mode === "base64") {
    return doc.output("datauristring");
  }
  doc.save(filename);
  return undefined;
}
