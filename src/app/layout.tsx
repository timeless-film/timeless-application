import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Timeless",
    template: "%s | Timeless",
  },
  description: "The distribution platform for classic and heritage films",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
