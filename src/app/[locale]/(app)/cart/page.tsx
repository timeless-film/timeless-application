import { getTranslations } from "next-intl/server";

import { getCartItems } from "@/components/booking/actions";
import { CartPageContent } from "@/components/booking/cart-page-content";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cart");
  return {
    title: t("title"),
  };
}

export default async function CartPage() {
  const t = await getTranslations("cart");
  const result = await getCartItems();
  const items = "success" in result ? result.data : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-6">
      <h1 className="font-heading text-3xl">{t("title")}</h1>
      <CartPageContent items={items} />
    </div>
  );
}
