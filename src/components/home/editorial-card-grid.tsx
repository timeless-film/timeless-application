import { Link } from "@/i18n/navigation";

import type { EditorialCardRow } from "@/lib/services/editorial-service";

interface EditorialCardGridProps {
  cards: EditorialCardRow[];
}

export function EditorialCardGrid({ cards }: EditorialCardGridProps) {
  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => {
        const isExternal = !card.href.startsWith("/");

        const content = (
          <div className="group relative aspect-[3/2] overflow-hidden rounded-lg shadow-md transition-all duration-300 hover:shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.imageUrl}
              alt={card.title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 left-0 p-3">
              <p className="text-sm font-semibold text-white md:text-base">{card.title}</p>
            </div>
          </div>
        );

        if (isExternal) {
          return (
            <a key={card.id} href={card.href} target="_blank" rel="noopener noreferrer">
              {content}
            </a>
          );
        }

        return (
          <Link key={card.id} href={card.href}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
