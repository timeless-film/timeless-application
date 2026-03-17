import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { legalAcceptances, legalDocuments } from "@/lib/db/schema";
import { sendLegalAcceptanceEmail } from "@/lib/email/legal-emails";

import type { InferSelectModel } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LegalDocument = InferSelectModel<typeof legalDocuments>;
export type LegalAcceptance = InferSelectModel<typeof legalAcceptances>;
export type LegalDocumentType = LegalDocument["type"];
export type LegalDocumentStatus = LegalDocument["status"];

// ─── Query: find the published document for a type + country ──────────────────

/**
 * Returns the currently published legal document matching the type and country.
 * Resolution order: exact country match → wildcard ["*"] fallback → null.
 */
export async function getPublishedDocument(
  type: LegalDocumentType,
  country?: string
): Promise<LegalDocument | null> {
  const published = await db
    .select()
    .from(legalDocuments)
    .where(and(eq(legalDocuments.type, type), eq(legalDocuments.status, "published")))
    .orderBy(desc(legalDocuments.publishedAt));

  if (published.length === 0) return null;

  // If a country is specified, try exact match first
  if (country) {
    const countryMatch = published.find((doc) => doc.countries.includes(country));
    if (countryMatch) return countryMatch;
  }

  // Fallback to worldwide document
  const wildcardMatch = published.find((doc) => doc.countries.includes("*"));
  return wildcardMatch ?? null;
}

/**
 * Get a document by ID.
 */
export async function getLegalDocumentById(id: string): Promise<LegalDocument | null> {
  const result = await db.select().from(legalDocuments).where(eq(legalDocuments.id, id)).limit(1);
  return result[0] ?? null;
}

/**
 * Get a published document by type and version (for historical viewing).
 */
export async function getLegalDocumentByVersion(
  type: LegalDocumentType,
  version: string
): Promise<LegalDocument | null> {
  const result = await db
    .select()
    .from(legalDocuments)
    .where(and(eq(legalDocuments.type, type), eq(legalDocuments.version, version)))
    .limit(1);
  return result[0] ?? null;
}

// ─── Query: check acceptance ──────────────────────────────────────────────────

/**
 * Check if a user has accepted the currently published CGU.
 * Returns the acceptance record if found, null otherwise.
 */
export async function hasUserAcceptedCurrentTerms(userId: string): Promise<LegalAcceptance | null> {
  const currentDoc = await getPublishedDocument("terms_of_service");
  if (!currentDoc) return null; // No published CGU → no acceptance needed

  const acceptance = await db
    .select()
    .from(legalAcceptances)
    .where(
      and(eq(legalAcceptances.legalDocumentId, currentDoc.id), eq(legalAcceptances.userId, userId))
    )
    .limit(1);

  return acceptance[0] ?? null;
}

/**
 * Check if an account has accepted the currently published CGV for its country.
 */
export async function hasAccountAcceptedCurrentTermsOfSale(
  accountId: string,
  country: string
): Promise<LegalAcceptance | null> {
  const currentDoc = await getPublishedDocument("terms_of_sale", country);
  if (!currentDoc) return null; // No published CGV → no acceptance needed

  const acceptance = await db
    .select()
    .from(legalAcceptances)
    .where(
      and(
        eq(legalAcceptances.legalDocumentId, currentDoc.id),
        eq(legalAcceptances.accountId, accountId)
      )
    )
    .limit(1);

  return acceptance[0] ?? null;
}

// ─── Mutation: record acceptance ──────────────────────────────────────────────

interface AcceptanceParams {
  documentId: string;
  userId: string;
  userName: string;
  userEmail: string;
  accountId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Record a user's acceptance of a legal document and send confirmation email.
 */
export async function recordAcceptance(params: AcceptanceParams): Promise<LegalAcceptance> {
  const document = await getLegalDocumentById(params.documentId);
  if (!document) {
    throw new Error(`Legal document not found: ${params.documentId}`);
  }
  if (document.status !== "published") {
    throw new Error(`Cannot accept non-published document: ${document.status}`);
  }

  const now = new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://timeless.film";

  const [acceptance] = await db
    .insert(legalAcceptances)
    .values({
      legalDocumentId: params.documentId,
      userId: params.userId,
      accountId: params.accountId ?? null,
      acceptedAt: now,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    })
    .returning();

  // Send confirmation email (best-effort, don't block on failure)
  try {
    const typeUrlMap: Record<string, string> = {
      terms_of_service: "/terms",
      terms_of_sale: "/terms/sale",
      privacy_policy: "/privacy",
    };
    const documentUrl = `${appUrl}/en${typeUrlMap[document.type] ?? "/terms"}?version=${encodeURIComponent(document.version)}`;

    await sendLegalAcceptanceEmail({
      email: params.userEmail,
      userName: params.userName,
      documentType: document.type,
      documentVersion: document.version,
      acceptedAt: now,
      documentUrl,
    });

    // Mark email as sent
    await db
      .update(legalAcceptances)
      .set({ emailSentAt: new Date() })
      .where(eq(legalAcceptances.id, acceptance!.id));
  } catch (error) {
    console.error("[Legal] Failed to send acceptance email:", error);
  }

  return acceptance!;
}

// ─── Admin: CRUD operations ───────────────────────────────────────────────────

interface CreateDocumentParams {
  type: LegalDocumentType;
  version: string;
  title: string;
  content: string;
  changeSummary?: string;
  countries: string[];
}

export async function createLegalDocument(params: CreateDocumentParams): Promise<LegalDocument> {
  const [document] = await db
    .insert(legalDocuments)
    .values({
      type: params.type,
      version: params.version,
      title: params.title,
      content: params.content,
      changeSummary: params.changeSummary ?? null,
      countries: params.countries,
      status: "draft",
    })
    .returning();

  return document!;
}

interface UpdateDocumentParams {
  id: string;
  title?: string;
  content?: string;
  changeSummary?: string;
  countries?: string[];
  version?: string;
}

export async function updateLegalDocument(params: UpdateDocumentParams): Promise<LegalDocument> {
  const existing = await getLegalDocumentById(params.id);
  if (!existing) throw new Error("Document not found");
  if (existing.status !== "draft") throw new Error("Cannot edit a published or archived document");

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (params.title !== undefined) updateData.title = params.title;
  if (params.content !== undefined) updateData.content = params.content;
  if (params.changeSummary !== undefined) updateData.changeSummary = params.changeSummary;
  if (params.countries !== undefined) updateData.countries = params.countries;
  if (params.version !== undefined) updateData.version = params.version;

  const [updated] = await db
    .update(legalDocuments)
    .set(updateData)
    .where(eq(legalDocuments.id, params.id))
    .returning();

  return updated!;
}

/**
 * Publish a draft document. Automatically archives the previous published
 * document of the same type with overlapping countries.
 */
export async function publishLegalDocument(id: string): Promise<LegalDocument> {
  const document = await getLegalDocumentById(id);
  if (!document) throw new Error("Document not found");
  if (document.status !== "draft") throw new Error("Only draft documents can be published");

  const now = new Date();

  // Archive previous published documents of same type with overlapping countries
  const previousPublished = await db
    .select()
    .from(legalDocuments)
    .where(and(eq(legalDocuments.type, document.type), eq(legalDocuments.status, "published")));

  for (const prev of previousPublished) {
    const hasOverlap =
      prev.countries.includes("*") ||
      document.countries.includes("*") ||
      prev.countries.some((c) => document.countries.includes(c));

    if (hasOverlap) {
      await db
        .update(legalDocuments)
        .set({ status: "archived", updatedAt: now })
        .where(eq(legalDocuments.id, prev.id));
    }
  }

  // Publish
  const [published] = await db
    .update(legalDocuments)
    .set({ status: "published", publishedAt: now, updatedAt: now })
    .where(eq(legalDocuments.id, id))
    .returning();

  return published!;
}

export async function archiveLegalDocument(id: string): Promise<LegalDocument> {
  const document = await getLegalDocumentById(id);
  if (!document) throw new Error("Document not found");
  if (document.status !== "published") throw new Error("Only published documents can be archived");

  const [archived] = await db
    .update(legalDocuments)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(legalDocuments.id, id))
    .returning();

  return archived!;
}

// ─── Admin: list & filter ─────────────────────────────────────────────────────

interface ListDocumentsParams {
  type?: LegalDocumentType;
  status?: LegalDocumentStatus;
}

export async function listLegalDocuments(params?: ListDocumentsParams): Promise<LegalDocument[]> {
  const conditions = [];
  if (params?.type) conditions.push(eq(legalDocuments.type, params.type));
  if (params?.status) conditions.push(eq(legalDocuments.status, params.status));

  return db
    .select()
    .from(legalDocuments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(legalDocuments.createdAt));
}

// ─── Admin: acceptances ───────────────────────────────────────────────────────

interface ListAcceptancesParams {
  documentId?: string;
  page?: number;
  limit?: number;
}

export async function listAcceptances(params?: ListAcceptancesParams) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (params?.documentId) {
    conditions.push(eq(legalAcceptances.legalDocumentId, params.documentId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db.query.legalAcceptances.findMany({
      where: whereClause,
      with: { document: true, user: true, account: true },
      orderBy: (a, { desc: d }) => d(a.acceptedAt),
      limit,
      offset,
    }),
    db.select({ id: legalAcceptances.id }).from(legalAcceptances).where(whereClause),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total: countResult.length,
    },
  };
}

/**
 * Bulk check: which document IDs from a list have been accepted by a user.
 */
export async function getAcceptedDocumentIds(
  userId: string,
  documentIds: string[]
): Promise<Set<string>> {
  if (documentIds.length === 0) return new Set();

  const acceptances = await db
    .select({ documentId: legalAcceptances.legalDocumentId })
    .from(legalAcceptances)
    .where(
      and(
        eq(legalAcceptances.userId, userId),
        inArray(legalAcceptances.legalDocumentId, documentIds)
      )
    );

  return new Set(acceptances.map((a) => a.documentId));
}
