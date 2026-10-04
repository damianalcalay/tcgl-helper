import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token_hash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const requested = params.get("next");
  const next = requested === "/auth/update-password" ? requested : "/decks";
  if (token_hash && type) {
    const client = await createClient();
    const { error } = await client.auth.verifyOtp({ token_hash, type });
    if (!error) redirect(next);
  }
  redirect("/auth/error");
}
