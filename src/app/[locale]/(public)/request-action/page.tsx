import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

import { loadRequestFromToken } from "./actions";
import { RequestActionForm } from "./request-action-form";

import type { Metadata } from "next";

interface PageProps {
  searchParams: Promise<{ token?: string; action?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const t = await getTranslations("requestAction");
  const params = await searchParams;
  const action = params.action;
  return {
    title: action === "reject" ? t("rejectTitle") : t("approveTitle"),
  };
}

export default async function RequestActionPage({ searchParams }: PageProps) {
  const t = await getTranslations("requestAction");
  const params = await searchParams;
  const { token, action } = params;

  // Validate query params
  if (!token || !action || (action !== "approve" && action !== "reject")) {
    return (
      <ErrorCard>
        <p>{t("tokenInvalid")}</p>
      </ErrorCard>
    );
  }

  // Load request data from token
  const result = await loadRequestFromToken(token);

  if ("error" in result && result.error) {
    const errorKey = mapErrorToTranslationKey(result.error);
    return (
      <ErrorCard>
        <p>{t(errorKey)}</p>
        {result.error === "TOKEN_EXPIRED" && (
          <Link href="/validation-requests" className="mt-4 inline-block text-sm underline">
            {t("goToDashboard")}
          </Link>
        )}
      </ErrorCard>
    );
  }

  if (!result.data) {
    return (
      <ErrorCard>
        <p>{t("requestNotFound")}</p>
      </ErrorCard>
    );
  }

  return (
    <RequestActionForm
      request={result.data}
      action={action as "approve" | "reject"}
      token={token}
    />
  );
}

function ErrorCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="text-center">Timeless</CardTitle>
      </CardHeader>
      <CardContent className="text-center text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

function mapErrorToTranslationKey(
  error: string
):
  | "tokenExpired"
  | "tokenInvalid"
  | "requestNotFound"
  | "alreadyApproved"
  | "alreadyRejected"
  | "alreadyCancelled"
  | "alreadyPaid" {
  switch (error) {
    case "TOKEN_EXPIRED":
      return "tokenExpired";
    case "TOKEN_INVALID":
      return "tokenInvalid";
    case "REQUEST_NOT_FOUND":
      return "requestNotFound";
    case "ALREADY_APPROVED":
      return "alreadyApproved";
    case "ALREADY_REJECTED":
      return "alreadyRejected";
    case "ALREADY_CANCELLED":
      return "alreadyCancelled";
    case "ALREADY_PAID":
      return "alreadyPaid";
    default:
      return "tokenInvalid";
  }
}
