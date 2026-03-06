import { Geist } from "next/font/google";

import type { Metadata } from "next";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TIMELESS",
    template: "%s | TIMELESS",
  },
  description: "The distribution platform for classic and heritage films",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geist.variable} antialiased`}>{children}</body>
    </html>
  );
}
