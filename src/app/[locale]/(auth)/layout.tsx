import { LanguageSwitcher } from "@/components/shared/language-switcher";

import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[oklch(0.10_0_0)]">
      <div className="flex justify-between items-center px-6 py-4">
        <span className="font-heading text-lg tracking-tight text-white">Timeless</span>
        <LanguageSwitcher />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
