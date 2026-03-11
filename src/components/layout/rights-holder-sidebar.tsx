"use client";

import { useMemo } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { usePendingRequestsCount } from "@/hooks/use-pending-requests-count";

import type { NavSection } from "@/components/app-sidebar";
import type { ComponentProps } from "react";

type RightsHolderSidebarProps = Omit<ComponentProps<typeof AppSidebar>, "sections"> & {
  sections: NavSection[];
};

export function RightsHolderSidebar({ sections, ...props }: RightsHolderSidebarProps) {
  const { data: pendingCount } = usePendingRequestsCount();

  const sectionsWithBadge = useMemo(() => {
    return sections.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        if (item.href === "/validation-requests" && pendingCount !== undefined) {
          return {
            ...item,
            badge: pendingCount,
            badgeVariant: pendingCount > 0 ? ("destructive" as const) : ("default" as const),
          };
        }
        return item;
      }),
    }));
  }, [sections, pendingCount]);

  return <AppSidebar sections={sectionsWithBadge} {...props} />;
}
