import { safeEmail } from "./safe-email";

import { emailLayout, escapeHtml } from "./index";

// ─── Legal acceptance confirmation email ──────────────────────────────────────

interface LegalAcceptanceEmailParams {
  email: string;
  userName: string;
  documentType: "terms_of_service" | "terms_of_sale" | "privacy_policy";
  documentVersion: string;
  acceptedAt: Date;
  documentUrl: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  terms_of_service: "Terms of Service / Conditions Générales d'Utilisation",
  terms_of_sale: "Terms of Sale / Conditions Générales de Vente",
  privacy_policy: "Privacy Policy / Politique de Confidentialité",
};

export async function sendLegalAcceptanceEmail(params: LegalAcceptanceEmailParams): Promise<void> {
  const typeLabel = DOCUMENT_TYPE_LABELS[params.documentType] ?? params.documentType;
  const formattedDate = params.acceptedAt
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");

  await safeEmail("sendLegalAcceptanceEmail", {
    to: params.email,
    subject: `${typeLabel} accepted — Timeless`,
    html: legalAcceptanceEmailHtml({
      userName: params.userName,
      typeLabel,
      version: params.documentVersion,
      formattedDate,
      documentUrl: params.documentUrl,
    }),
  });
}

function legalAcceptanceEmailHtml(params: {
  userName: string;
  typeLabel: string;
  version: string;
  formattedDate: string;
  documentUrl: string;
}): string {
  return emailLayout(`
    <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">Legal document accepted</p>
    <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">
      Hi ${escapeHtml(params.userName)}, this email confirms that you have accepted the following document on Timeless:
    </p>
    <table style="margin:0 0 24px 0;font-size:14px;color:#333333;line-height:1.6;border-collapse:collapse" width="100%">
      <tr>
        <td style="padding:8px 16px 8px 0;font-weight:600;white-space:nowrap;vertical-align:top">Document</td>
        <td style="padding:8px 0">${escapeHtml(params.typeLabel)}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0;font-weight:600;white-space:nowrap;vertical-align:top">Version</td>
        <td style="padding:8px 0">${escapeHtml(params.version)}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0;font-weight:600;white-space:nowrap;vertical-align:top">Accepted on</td>
        <td style="padding:8px 0">${escapeHtml(params.formattedDate)}</td>
      </tr>
    </table>
    <a href="${params.documentUrl}"
       style="display:inline-block;background:#111111;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
      View the document
    </a>
    <p style="margin:24px 0 0 0;font-size:13px;color:#999999">
      This email serves as timestamped proof of your acceptance. Please keep it for your records.
    </p>
  `);
}
