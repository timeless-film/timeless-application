import { LegalHeader } from "./legal-header";

import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <LegalHeader />
      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
