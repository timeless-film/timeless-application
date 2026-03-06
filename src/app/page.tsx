import { redirect } from "next/navigation";

// Redirect to login — middleware handles post-auth redirection
export default function RootPage() {
  redirect("/login");
}
