import { Gloock, Open_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const gloock = Gloock({
  variable: "--font-gloock",
  weight: "400",
  subsets: ["latin"],
});

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "fr")) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${openSans.variable} ${gloock.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
