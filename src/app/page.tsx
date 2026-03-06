import { redirect } from "next/navigation";

// Redirige vers le login — le middleware gère la redirection post-auth
export default function RootPage() {
  redirect("/login");
}
