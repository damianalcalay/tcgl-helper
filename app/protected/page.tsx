import { redirect } from "next/navigation";
export default function Protected() {
  redirect("/decks");
}
