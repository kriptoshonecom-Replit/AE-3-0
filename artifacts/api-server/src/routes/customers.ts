import { Router } from "express";
import { db } from "@workspace/db";
import { quotesTable, usersTable, customersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { sendEmail } from "../lib/email";
import { downloadPdf } from "../lib/pdfStorage";
import { logger } from "../lib/logger";
import type { CustomerRow } from "@workspace/db/schema";

const router = Router();

interface QuoteRow {
  id: string;
  data: unknown;
  quoteNumber: string | null;
  companyName: string | null;
  customerName: string | null;
  createdAt: Date;
  updatedAt: Date;
  passStatus: string | null;
  userId: string;
  pdfSavedAt: Date | null;
  creatorName?: string | null;
  creatorEmail?: string | null;
}

function getMeta(row: QuoteRow): Record<string, string> {
  return ((row.data as Record<string, unknown>)?.meta as Record<string, string>) ?? {};
}

function customerKey(meta: Record<string, string>): string {
  const mcn = (meta.mcn ?? "").trim();
  const email = (meta.customerEmail ?? "").trim().toLowerCase();
  return mcn || email || `${(meta.companyName ?? "").trim()}___${(meta.customerName ?? "").trim()}`;
}

function buildCustomers(quoteRows: QuoteRow[], storedRows: CustomerRow[]) {
  type CustomerData = {
    key: string;
    companyName: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    mcn: string | null;
    address: Record<string, string> | null;
    billingAddress: Record<string, string> | null;
    quotes: Array<{
      id: string;
      quoteNumber: string | null;
      passStatus: string | null;
      createdAt: string;
      updatedAt: string;
      data: unknown;
      pdfSavedAt: string | null;
    }>;
    passCount: number;
    failCount: number;
    lastActivity: string;
    creatorName: string | null;
    creatorEmail: string | null;
    userId: string;
  };

  const byKey = new Map<string, CustomerData>();

  // Seed from the persistent customers table first
  for (const c of storedRows) {
    byKey.set(c.id, {
      key: c.id,
      companyName: c.companyName ?? "",
      customerName: c.customerName ?? "",
      customerEmail: c.customerEmail ?? "",
      customerPhone: c.customerPhone ?? "",
      mcn: c.mcn ?? null,
      address: (c.address as Record<string, string> | null) ?? null,
      billingAddress: (c.billingAddress as Record<string, string> | null) ?? null,
      quotes: [],
      passCount: 0,
      failCount: 0,
      lastActivity: c.updatedAt.toISOString(),
      creatorName: null,
      creatorEmail: null,
      userId: c.creatorUserId ?? "",
    });
  }

  // Overlay quote data
  for (const row of quoteRows) {
    const meta = getMeta(row);
    const key = customerKey(meta);
    if (!key || key === "___") continue;

    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        companyName: meta.companyName || row.companyName || "",
        customerName: meta.customerName || row.customerName || "",
        customerEmail: (meta.customerEmail ?? "").trim().toLowerCase(),
        customerPhone: meta.customerPhone || "",
        address: null,
        billingAddress: null,
        mcn: meta.mcn || null,
        quotes: [],
        passCount: 0,
        failCount: 0,
        lastActivity: row.updatedAt.toISOString(),
        creatorName: row.creatorName ?? null,
        creatorEmail: row.creatorEmail ?? null,
        userId: row.userId,
      });
    }

    const c = byKey.get(key)!;

    if (row.updatedAt > new Date(c.lastActivity)) {
      c.lastActivity = row.updatedAt.toISOString();
    }

    if (!c.customerPhone && meta.customerPhone) c.customerPhone = meta.customerPhone;
    if (!c.mcn && meta.mcn) c.mcn = meta.mcn;
    if (!c.creatorName && row.creatorName) c.creatorName = row.creatorName;
    if (!c.creatorEmail && row.creatorEmail) c.creatorEmail = row.creatorEmail;

    if ((meta.addressLine || meta.addressCity || meta.addressName) && !c.address) {
      c.address = {
        line: meta.addressLine || "",
        name: meta.addressName || "",
        number: meta.addressNumber || "",
        city: meta.addressCity || "",
        state: meta.addressState || "",
        zip: meta.zipCode || "",
        country: meta.addressCountry || "",
      };
    }

    if (!meta.sameForBilling && (meta.billingAddressLine || meta.billingAddressCity || meta.billingAddressName) && !c.billingAddress) {
      c.billingAddress = {
        line: meta.billingAddressLine || "",
        name: meta.billingAddressName || "",
        number: meta.billingAddressNumber || "",
        city: meta.billingAddressCity || "",
        state: meta.billingAddressState || "",
        zip: meta.billingZipCode || "",
        country: meta.billingAddressCountry || "",
      };
    }

    const status = row.passStatus ?? (meta.passStatus as string | undefined) ?? null;
    if (status === "pass") c.passCount++;
    else if (status === "fail") c.failCount++;

    c.quotes.push({
      id: row.id,
      quoteNumber: row.quoteNumber,
      passStatus: status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      data: row.data,
      pdfSavedAt: row.pdfSavedAt ? row.pdfSavedAt.toISOString() : null,
    });
  }

  return Array.from(byKey.values())
    .sort((a, b) => (a.companyName || a.customerName).localeCompare(b.companyName || b.customerName));
}

const QUOTE_SELECT = {
  id: quotesTable.id,
  data: quotesTable.data,
  quoteNumber: quotesTable.quoteNumber,
  companyName: quotesTable.companyName,
  customerName: quotesTable.customerName,
  createdAt: quotesTable.createdAt,
  updatedAt: quotesTable.updatedAt,
  passStatus: quotesTable.passStatus,
  userId: quotesTable.userId,
  pdfSavedAt: quotesTable.pdfSavedAt,
  creatorName: usersTable.fullName,
  creatorEmail: usersTable.email,
} as const;

async function fetchCustomers() {
  const [quoteRows, storedRows] = await Promise.all([
    db.select(QUOTE_SELECT).from(quotesTable).leftJoin(usersTable, eq(quotesTable.userId, usersTable.id)).orderBy(quotesTable.updatedAt),
    db.select().from(customersTable),
  ]);
  return buildCustomers(quoteRows, storedRows);
}

router.get("/customers", requireAuth, async (_req, res) => {
  try {
    const customers = await fetchCustomers();
    res.json({ customers });
  } catch (err) {
    logger.error(err, "GET /customers error");
    res.status(500).json({ error: "Failed to load customers" });
  }
});

router.get("/admin/customers", requireAdmin, async (_req, res) => {
  try {
    const customers = await fetchCustomers();
    res.json({ customers });
  } catch (err) {
    logger.error(err, "GET /admin/customers error");
    res.status(500).json({ error: "Failed to load customers" });
  }
});

router.patch("/admin/customers/:key", requireAdmin, async (req, res) => {
  const key = decodeURIComponent(String(req.params.key));
  const { companyName, customerName, customerEmail, customerPhone } = req.body as {
    companyName?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
  };

  try {
    // Update the persistent customer record
    await db
      .insert(customersTable)
      .values({
        id: key,
        companyName: companyName ?? null,
        customerName: customerName ?? null,
        customerEmail: customerEmail ?? null,
        customerPhone: customerPhone ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: customersTable.id,
        set: {
          ...(companyName !== undefined && { companyName }),
          ...(customerName !== undefined && { customerName }),
          ...(customerEmail !== undefined && { customerEmail }),
          ...(customerPhone !== undefined && { customerPhone }),
          updatedAt: new Date(),
        },
      });

    // Also update all quote metas for display consistency
    const allRows = await db.select().from(quotesTable);
    const toUpdate = allRows.filter(r => {
      const meta = getMeta({ data: r.data } as QuoteRow);
      return customerKey(meta) === key;
    });

    for (const row of toUpdate) {
      const data = row.data as Record<string, unknown>;
      const meta = (data.meta as Record<string, unknown>) ?? {};
      const updatedMeta = {
        ...meta,
        ...(companyName !== undefined && { companyName }),
        ...(customerName !== undefined && { customerName }),
        ...(customerEmail !== undefined && { customerEmail }),
        ...(customerPhone !== undefined && { customerPhone }),
      };
      await db.update(quotesTable)
        .set({
          data: { ...data, meta: updatedMeta },
          ...(companyName !== undefined && { companyName }),
          ...(customerName !== undefined && { customerName }),
          updatedAt: new Date(),
        })
        .where(eq(quotesTable.id, row.id));
    }

    res.json({ updated: toUpdate.length });
  } catch (err) {
    logger.error(err, "PATCH /admin/customers/:key error");
    res.status(500).json({ error: "Failed to update customer" });
  }
});

router.delete("/admin/customers/:key", requireAdmin, async (req, res) => {
  const key = decodeURIComponent(String(req.params.key));
  try {
    // Remove from customers table only — quotes are preserved
    const deleted = await db
      .delete(customersTable)
      .where(eq(customersTable.id, key))
      .returning({ id: customersTable.id });

    if (deleted.length === 0) {
      // Customer may only exist in quotes (legacy); nothing to do in the customers table
      res.status(404).json({ error: "Customer record not found" });
      return;
    }

    res.json({ deleted: deleted.length });
  } catch (err) {
    logger.error(err, "DELETE /admin/customers/:key error");
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

router.post("/admin/customers/create", requireAdmin, async (req, res) => {
  const {
    companyName, customerName, customerEmail, customerPhone,
    mcn, salesRep, fua, dba, businessOperation, validUntil,
    address, billingAddress,
  } = req.body as {
    companyName?: string; customerName?: string; customerEmail?: string;
    customerPhone?: string; mcn?: string; salesRep?: string;
    fua?: number; dba?: string; businessOperation?: string; validUntil?: string;
    address?: Record<string, string> | null;
    billingAddress?: Record<string, string> | null;
  };

  const email = (customerEmail ?? "").trim().toLowerCase();
  const mcnTrim = (mcn ?? "").trim();
  const compTrim = (companyName ?? "").trim();
  const nameTrim = (customerName ?? "").trim();
  const key = mcnTrim || email || `${compTrim}___${nameTrim}`;

  if (!key || key === "___") {
    res.status(400).json({ error: "Provide at least one of: MCN, email, company name, or customer name." });
    return;
  }

  try {
    const { userId: adminUserId } = req.auth!;
    await db
      .insert(customersTable)
      .values({
        id: key,
        companyName: companyName ?? null,
        customerName: customerName ?? null,
        customerEmail: email || null,
        customerPhone: customerPhone ?? null,
        mcn: mcnTrim || null,
        address: address ?? null,
        billingAddress: billingAddress ?? null,
        creatorUserId: adminUserId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: customersTable.id,
        set: {
          companyName: companyName ?? null,
          customerName: customerName ?? null,
          customerEmail: email || null,
          customerPhone: customerPhone ?? null,
          mcn: mcnTrim || null,
          ...(address !== undefined && { address }),
          ...(billingAddress !== undefined && { billingAddress }),
          updatedAt: new Date(),
        },
      });

    // Build a minimal stub quote so the customer appears with metadata
    const quoteId = crypto.randomUUID();
    const now = new Date().toISOString();
    const meta: Record<string, unknown> = {
      id: quoteId,
      companyName: companyName ?? "",
      customerName: customerName ?? "",
      customerEmail: email,
      customerPhone: customerPhone ?? "",
      mcn: mcnTrim || undefined,
      salesRep: salesRep ?? "",
      fua: fua ?? undefined,
      dba: dba ?? undefined,
      businessOperation: businessOperation ?? undefined,
      validUntil: validUntil ?? "",
      quoteNumber: "",
      oppNumber: "",
      discount: 0,
      tax: 0,
      notes: "",
      createdAt: now,
      updatedAt: now,
      ...(address && {
        addressName: address.name,
        addressNumber: address.number,
        addressLine: address.line,
        addressCity: address.city,
        addressState: address.state,
        zipCode: address.zip,
        addressCountry: address.country,
      }),
      ...(billingAddress && {
        billingAddressName: billingAddress.name,
        billingAddressNumber: billingAddress.number,
        billingAddressLine: billingAddress.line,
        billingAddressCity: billingAddress.city,
        billingAddressState: billingAddress.state,
        billingZipCode: billingAddress.zip,
        billingAddressCountry: billingAddress.country,
      }),
    };

    await db.insert(quotesTable).values({
      id: quoteId,
      userId: adminUserId,
      companyName: companyName ?? null,
      customerName: customerName ?? null,
      data: { meta, groups: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const customers = await fetchCustomers();
    const created = customers.find(c => c.key === key);
    res.status(201).json({ customer: created ?? { key } });
  } catch (err) {
    logger.error(err, "POST /admin/customers/create error");
    res.status(500).json({ error: "Failed to create customer" });
  }
});

router.post("/customers/send-email", requireAuth, async (req, res) => {
  const { to, subject, body, attachments } = req.body as {
    to: string;
    subject: string;
    body: string;
    attachments?: { type: "quote" | "amendment"; id: string; filename: string }[];
  };
  if (!to || !subject || !body) {
    res.status(400).json({ error: "to, subject, and body are required" });
    return;
  }
  try {
    const emailAttachments: { filename: string; content: Buffer }[] = [];

    if (attachments?.length) {
      for (const a of attachments) {
        try {
          const storagePath = `pdfs/${a.type === "quote" ? "quotes" : "amendments"}/${a.id}.pdf`;
          const buf = await downloadPdf(storagePath);
          if (buf) {
            emailAttachments.push({ filename: a.filename, content: buf });
          } else {
            logger.warn({ id: a.id, type: a.type }, "PDF not found in storage for attachment");
          }
        } catch (attachErr) {
          logger.warn({ attachErr, id: a.id }, "Failed to fetch attachment PDF");
        }
      }
    }

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1e293b">
        <h2 style="color:#7c3aed;margin:0 0 4px">Aloha WebCalculator</h2>
        <p style="color:#64748b;font-size:13px;margin:0 0 28px">Quote Builder Platform</p>

        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:24px;font-size:14px;color:#334155;line-height:1.7">
          ${body.replace(/\n/g, "<br>")}
        </div>

        <p style="font-size:12px;color:#94a3b8;margin:0">
          You received this message via Aloha WebCalculator.
        </p>
      </div>
    `;
    await sendEmail(
      to,
      subject,
      html,
      emailAttachments.length ? emailAttachments : undefined,
    );
    res.json({ sent: true });
  } catch (err) {
    logger.error(err, "POST /customers/send-email error");
    res.status(500).json({ error: "Failed to send email" });
  }
});

export default router;
