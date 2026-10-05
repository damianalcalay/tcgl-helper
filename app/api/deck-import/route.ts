import { createClient } from "@/lib/supabase/server";
import { parseDeckList } from "@/lib/domain/deck-import";
import { enrichDeck } from "@/lib/tcgdex";

export async function POST(request: Request) {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    return Response.json(
      { error: "Sign in again to import a deck." },
      { status: 401 },
    );
  try {
    const body = await request.json();
    if (typeof body.text !== "string")
      throw new Error("Paste a deck list first.");
    return Response.json(await enrichDeck(parseDeckList(body.text)));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to import deck.",
      },
      { status: 400 },
    );
  }
}
