import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getAllMemberships } from "@/lib/auth/membership";

import { AccountSelector } from "./account-selector";

export default async function SelectAccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const memberships = await getAllMemberships(session.user.id);

  if (memberships.length === 0) {
    redirect("/no-account");
  }

  return <AccountSelector memberships={memberships} />;
}
