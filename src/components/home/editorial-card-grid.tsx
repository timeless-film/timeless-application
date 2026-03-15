import type { EditorialCardRow } from "@/lib/services/editorial-service";

interface EditorialCardGridProps {
  cards: EditorialCardRow[];
}

export function EditorialCardGrid({ cards }: EditorialCardGridProps) {
  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => (
        <a
          key={card.id}
          href={card.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group space-y-2"
        >
          <div className="relative aspect-[3/2] overflow-hidden rounded-lg shadow-md transition-all duration-300 group-hover:shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.imageUrl}
              alt={card.title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div>
            <p className="text-sm font-semibold md:text-base">{card.title}</p>
            {card.description && (
              <p className="text-xs text-muted-foreground md:text-sm">{card.description}</p>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
