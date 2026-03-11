import { formatAmount } from "@/lib/pricing/format";

import { safeEmail } from "./safe-email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RequestNotificationParams {
  requestId: string;
  token: string;
  filmTitle: string;
  exhibitorCompanyName: string;
  exhibitorCountry: string;
  exhibitorVatNumber: string | null;
  cinemaName: string;
  cinemaAddress: string | null;
  cinemaCity: string | null;
  cinemaPostalCode: string | null;
  cinemaCountry: string;
  roomName: string;
  roomCapacity: number;
  screeningCount: number;
  startDate: string | null;
  endDate: string | null;
  displayedPrice: number;
  rightsHolderAmount: number;
  currency: string;
  note: string | null;
  recipientEmail: string;
  recipientName: string;
  recipientLocale: string;
}

export interface RequestDecisionEmailParams {
  filmTitle: string;
  exhibitorCompanyName: string;
  cinemaName: string;
  roomName: string;
  screeningCount: number;
  startDate: string | null;
  endDate: string | null;
  displayedPrice: number;
  currency: string;
  note: string | null;
  recipientEmail: string;
  recipientName: string;
  recipientLocale: string;
}

export interface RequestApprovedEmailParams extends RequestDecisionEmailParams {
  approvalNote: string | null;
}

export interface RequestRejectedEmailParams extends RequestDecisionEmailParams {
  rejectionReason: string | null;
}

// ─── Translations ─────────────────────────────────────────────────────────────

const translations = {
  en: {
    notification: {
      subject: "New booking request for {filmTitle}",
      title: "New booking request",
      intro: "A new booking request has been submitted for your film.",
      filmLabel: "Film",
      exhibitorLabel: "Exhibitor",
      countryLabel: "Country",
      vatLabel: "VAT Number",
      cinemaLabel: "Cinema",
      addressLabel: "Address",
      roomLabel: "Screen",
      seatsLabel: "seats",
      screeningsLabel: "Number of screenings",
      datesLabel: "Dates",
      priceExhibitorLabel: "Price (exhibitor)",
      priceYoursLabel: "Your revenue",
      noteLabel: "Note from exhibitor",
      acceptButton: "Accept",
      rejectButton: "Reject",
      fallbackText: "If buttons don't work, manage this request from your dashboard:",
      dashboardLink: "Go to dashboard",
      noDate: "Not specified",
    },
    approved: {
      subject: "Your request for {filmTitle} has been approved",
      title: "Request approved",
      intro: "Great news! Your booking request has been approved by the rights holder.",
      noteLabel: "Note from rights holder",
      ctaButton: "View my request",
      paymentNote: "You will be able to proceed to payment shortly.",
    },
    rejected: {
      subject: "Your request for {filmTitle} has been declined",
      title: "Request declined",
      intro: "Unfortunately, your booking request has been declined by the rights holder.",
      reasonLabel: "Reason",
      noReason: "No reason provided.",
      ctaButton: "View my requests",
      resubmitNote: "You can submit a new request if you wish.",
    },
  },
  fr: {
    notification: {
      subject: "Nouvelle demande de réservation pour {filmTitle}",
      title: "Nouvelle demande de réservation",
      intro: "Une nouvelle demande de réservation a été soumise pour votre film.",
      filmLabel: "Film",
      exhibitorLabel: "Exploitant",
      countryLabel: "Pays",
      vatLabel: "Numéro de TVA",
      cinemaLabel: "Cinéma",
      addressLabel: "Adresse",
      roomLabel: "Salle",
      seatsLabel: "places",
      screeningsLabel: "Nombre de visionnages",
      datesLabel: "Dates",
      priceExhibitorLabel: "Prix (exploitant)",
      priceYoursLabel: "Votre revenu",
      noteLabel: "Note de l'exploitant",
      acceptButton: "Accepter",
      rejectButton: "Refuser",
      fallbackText:
        "Si les boutons ne fonctionnent pas, gérez cette demande depuis votre tableau de bord :",
      dashboardLink: "Accéder au tableau de bord",
      noDate: "Non précisé",
    },
    approved: {
      subject: "Votre demande pour {filmTitle} a été acceptée",
      title: "Demande acceptée",
      intro: "Bonne nouvelle ! Votre demande de réservation a été acceptée par l'ayant droit.",
      noteLabel: "Commentaire de l'ayant droit",
      ctaButton: "Voir ma demande",
      paymentNote: "Vous pourrez prochainement procéder au paiement.",
    },
    rejected: {
      subject: "Votre demande pour {filmTitle} a été refusée",
      title: "Demande refusée",
      intro: "Malheureusement, votre demande de réservation a été refusée par l'ayant droit.",
      reasonLabel: "Motif",
      noReason: "Aucun motif communiqué.",
      ctaButton: "Voir mes demandes",
      resubmitNote: "Vous pouvez soumettre une nouvelle demande si vous le souhaitez.",
    },
  },
} as const;

type Locale = "en" | "fr";
type Translations = (typeof translations)[Locale];

function getTranslation(locale: string): Translations {
  return translations[locale === "fr" ? "fr" : "en"];
}

function localeForFormat(locale: string): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

// ─── Email layout (same as main email module) ─────────────────────────────────

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:48px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;padding:40px">
        <tr><td>
          <p style="margin:0 0 32px 0;font-size:18px;font-weight:600;letter-spacing:0.05em;color:#111111">Timeless</p>
          ${content}
          <hr style="border:none;border-top:1px solid #eeeeee;margin:32px 0">
          <p style="margin:0;font-size:12px;color:#999999">&copy; Timeless &mdash; <a href="https://timeless.film" style="color:#999999">timeless.film</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function formatDates(
  startDate: string | null,
  endDate: string | null,
  locale: string,
  noDateText: string
): string {
  if (!startDate) return noDateText;
  const fmt = new Intl.DateTimeFormat(localeForFormat(locale), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const start = fmt.format(new Date(startDate));
  if (!endDate) return start;
  const end = fmt.format(new Date(endDate));
  return `${start} → ${end}`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:4px 16px 4px 0;font-size:14px;color:#999999;white-space:nowrap;vertical-align:top">${label}</td>
    <td style="padding:4px 0;font-size:14px;color:#333333">${value}</td>
  </tr>`;
}

// ─── Email functions ──────────────────────────────────────────────────────────

/**
 * Send notification email to a rights holder user about a new validation request.
 * Contains all request details + Accept/Reject CTA buttons.
 */
export async function sendRequestNotificationToRightsHolder(
  params: RequestNotificationParams
): Promise<void> {
  const t = getTranslation(params.recipientLocale);
  const locale = params.recipientLocale === "fr" ? "fr" : "en";
  const fmtLocale = localeForFormat(locale);

  const approveUrl = `${APP_URL}/${locale}/request-action?token=${encodeURIComponent(params.token)}&action=approve`;
  const rejectUrl = `${APP_URL}/${locale}/request-action?token=${encodeURIComponent(params.token)}&action=reject`;
  const dashboardUrl = `${APP_URL}/${locale}/validation-requests`;

  const address = [
    params.cinemaAddress,
    params.cinemaPostalCode,
    params.cinemaCity,
    params.cinemaCountry,
  ]
    .filter(Boolean)
    .join(", ");

  const dateStr = formatDates(params.startDate, params.endDate, locale, t.notification.noDate);

  const noteSection = params.note
    ? `<tr><td colspan="2" style="padding:12px 0 0 0">
        <p style="margin:0 0 4px 0;font-size:14px;color:#999999">${t.notification.noteLabel}</p>
        <p style="margin:0;font-size:14px;color:#333333;background:#f9f9f9;padding:12px;border-radius:6px;white-space:pre-wrap">${escapeHtml(params.note)}</p>
      </td></tr>`
    : "";

  const html = emailLayout(`
    <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">${t.notification.title}</p>
    <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">${t.notification.intro}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0">
      ${infoRow(t.notification.filmLabel, `<strong>${escapeHtml(params.filmTitle)}</strong>`)}
      ${infoRow(t.notification.exhibitorLabel, escapeHtml(params.exhibitorCompanyName))}
      ${infoRow(t.notification.countryLabel, params.exhibitorCountry)}
      ${params.exhibitorVatNumber ? infoRow(t.notification.vatLabel, params.exhibitorVatNumber) : ""}
      ${infoRow(t.notification.cinemaLabel, escapeHtml(params.cinemaName))}
      ${address ? infoRow(t.notification.addressLabel, escapeHtml(address)) : ""}
      ${infoRow(t.notification.roomLabel, `${escapeHtml(params.roomName)} (${params.roomCapacity} ${t.notification.seatsLabel})`)}
      ${infoRow(t.notification.screeningsLabel, String(params.screeningCount))}
      ${infoRow(t.notification.datesLabel, dateStr)}
      ${infoRow(t.notification.priceExhibitorLabel, formatAmount(params.displayedPrice, params.currency, fmtLocale))}
      ${infoRow(t.notification.priceYoursLabel, formatAmount(params.rightsHolderAmount, params.currency, fmtLocale))}
      ${noteSection}
    </table>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 16px 0">
      <tr>
        <td style="padding-right:12px">
          <a href="${approveUrl}"
             style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
            ${t.notification.acceptButton}
          </a>
        </td>
        <td>
          <a href="${rejectUrl}"
             style="display:inline-block;background:#dc2626;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
            ${t.notification.rejectButton}
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px 0;font-size:13px;color:#999999">${t.notification.fallbackText}</p>
    <a href="${dashboardUrl}" style="font-size:13px;color:#555555">${t.notification.dashboardLink}</a>
  `);

  await safeEmail("sendRequestNotificationToRightsHolder", {
    to: params.recipientEmail,
    subject: t.notification.subject.replace("{filmTitle}", params.filmTitle),
    html,
  });
}

/**
 * Send approval notification email to an exhibitor user.
 */
export async function sendRequestApprovedToExhibitor(
  params: RequestApprovedEmailParams
): Promise<void> {
  const t = getTranslation(params.recipientLocale);
  const locale = params.recipientLocale === "fr" ? "fr" : "en";
  const fmtLocale = localeForFormat(locale);
  const requestsUrl = `${APP_URL}/${locale}/requests`;

  const dateStr = formatDates(params.startDate, params.endDate, locale, "—");

  const noteSection = params.approvalNote
    ? `<p style="margin:0 0 4px 0;font-size:14px;color:#999999">${t.approved.noteLabel}</p>
       <p style="margin:0 0 24px 0;font-size:14px;color:#333333;background:#f9f9f9;padding:12px;border-radius:6px;white-space:pre-wrap">${escapeHtml(params.approvalNote)}</p>`
    : "";

  const html = emailLayout(`
    <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#16a34a">${t.approved.title}</p>
    <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">${t.approved.intro}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0">
      ${infoRow("Film", `<strong>${escapeHtml(params.filmTitle)}</strong>`)}
      ${infoRow("Cinema", escapeHtml(params.cinemaName))}
      ${infoRow("Screen", escapeHtml(params.roomName))}
      ${infoRow("Screenings", String(params.screeningCount))}
      ${infoRow("Dates", dateStr)}
      ${infoRow("Price", formatAmount(params.displayedPrice, params.currency, fmtLocale))}
    </table>
    ${noteSection}
    <p style="margin:0 0 24px 0;font-size:14px;color:#555555">${t.approved.paymentNote}</p>
    <a href="${requestsUrl}"
       style="display:inline-block;background:#111111;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
      ${t.approved.ctaButton}
    </a>
  `);

  await safeEmail("sendRequestApprovedToExhibitor", {
    to: params.recipientEmail,
    subject: t.approved.subject.replace("{filmTitle}", params.filmTitle),
    html,
  });
}

/**
 * Send rejection notification email to an exhibitor user.
 */
export async function sendRequestRejectedToExhibitor(
  params: RequestRejectedEmailParams
): Promise<void> {
  const t = getTranslation(params.recipientLocale);
  const locale = params.recipientLocale === "fr" ? "fr" : "en";
  const requestsUrl = `${APP_URL}/${locale}/requests`;

  const reasonSection = params.rejectionReason
    ? `<p style="margin:0 0 4px 0;font-size:14px;color:#999999">${t.rejected.reasonLabel}</p>
       <p style="margin:0 0 24px 0;font-size:14px;color:#333333;background:#f9f9f9;padding:12px;border-radius:6px;white-space:pre-wrap">${escapeHtml(params.rejectionReason)}</p>`
    : `<p style="margin:0 0 24px 0;font-size:14px;color:#999999;font-style:italic">${t.rejected.noReason}</p>`;

  const html = emailLayout(`
    <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#dc2626">${t.rejected.title}</p>
    <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">${t.rejected.intro}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0">
      ${infoRow("Film", `<strong>${escapeHtml(params.filmTitle)}</strong>`)}
      ${infoRow("Cinema", escapeHtml(params.cinemaName))}
    </table>
    ${reasonSection}
    <p style="margin:0 0 24px 0;font-size:14px;color:#555555">${t.rejected.resubmitNote}</p>
    <a href="${requestsUrl}"
       style="display:inline-block;background:#111111;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
      ${t.rejected.ctaButton}
    </a>
  `);

  await safeEmail("sendRequestRejectedToExhibitor", {
    to: params.recipientEmail,
    subject: t.rejected.subject.replace("{filmTitle}", params.filmTitle),
    html,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
