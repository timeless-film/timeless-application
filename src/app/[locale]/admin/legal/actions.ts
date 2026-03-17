"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getActiveAccountCookie } from "@/lib/auth/membership";
import {
  archiveLegalDocument,
  createLegalDocument,
  getLegalDocumentById,
  listAcceptances,
  listLegalDocuments,
  publishLegalDocument,
  updateLegalDocument,
} from "@/lib/services/legal-service";

import type { LegalDocumentStatus, LegalDocumentType } from "@/lib/services/legal-service";

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const activeCookie = await getActiveAccountCookie();
  if (!activeCookie || activeCookie.type !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  return { userId: session.user.id };
}

// ─── List documents ───────────────────────────────────────────────────────────

export async function listLegalDocumentsAction(filters?: {
  type?: LegalDocumentType;
  status?: LegalDocumentStatus;
}) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult;

  const documents = await listLegalDocuments(filters);
  return { success: true as const, documents };
}

// ─── Get document detail ──────────────────────────────────────────────────────

export async function getLegalDocumentAction(id: string) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult;

  const document = await getLegalDocumentById(id);
  if (!document) return { error: "NOT_FOUND" as const };

  return { success: true as const, document };
}

// ─── Create document ──────────────────────────────────────────────────────────

interface CreateDocumentInput {
  type: LegalDocumentType;
  version: string;
  title: string;
  content: string;
  changeSummary?: string;
  countries: string[];
}

export async function createLegalDocumentAction(input: CreateDocumentInput) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult;

  if (!input.type || !input.version.trim() || !input.title.trim() || !input.content.trim()) {
    return { error: "INVALID_INPUT" as const };
  }

  if (input.countries.length === 0) {
    return { error: "INVALID_INPUT" as const, field: "countries" as const };
  }

  try {
    const document = await createLegalDocument({
      type: input.type,
      version: input.version.trim(),
      title: input.title.trim(),
      content: input.content.trim(),
      changeSummary: input.changeSummary?.trim(),
      countries: input.countries,
    });

    return { success: true as const, document };
  } catch (error) {
    console.error("Failed to create legal document:", error);
    return { error: "CREATION_FAILED" as const };
  }
}

// ─── Update document ──────────────────────────────────────────────────────────

interface UpdateDocumentInput {
  id: string;
  title?: string;
  content?: string;
  changeSummary?: string;
  countries?: string[];
  version?: string;
}

export async function updateLegalDocumentAction(input: UpdateDocumentInput) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult;

  try {
    const document = await updateLegalDocument(input);
    return { success: true as const, document };
  } catch (error) {
    console.error("Failed to update legal document:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Cannot edit")) {
      return { error: "CANNOT_EDIT_PUBLISHED" as const };
    }
    return { error: "UPDATE_FAILED" as const };
  }
}

// ─── Publish document ─────────────────────────────────────────────────────────

export async function publishLegalDocumentAction(id: string) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult;

  try {
    const document = await publishLegalDocument(id);
    return { success: true as const, document };
  } catch (error) {
    console.error("Failed to publish legal document:", error);
    return { error: "PUBLISH_FAILED" as const };
  }
}

// ─── Archive document ─────────────────────────────────────────────────────────

export async function archiveLegalDocumentAction(id: string) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult;

  try {
    const document = await archiveLegalDocument(id);
    return { success: true as const, document };
  } catch (error) {
    console.error("Failed to archive legal document:", error);
    return { error: "ARCHIVE_FAILED" as const };
  }
}

// ─── List acceptances ─────────────────────────────────────────────────────────

export async function listAcceptancesAction(params?: {
  documentId?: string;
  page?: number;
  limit?: number;
}) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult;

  const result = await listAcceptances(params);
  return { success: true as const, ...result };
}
