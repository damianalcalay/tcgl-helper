import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  AppData,
  Card,
  Deck,
  DeckCard,
  Match,
  Prize,
  Roster,
  Variant,
} from "@/types/domain";
import { redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
async function allRows<T>(client: SupabaseClient, table: string): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 1000) {
    const order =
      table === "deck_cards" || table === "deck_variants"
        ? "deck_id"
        : table === "match_rosters" || table === "match_prizes"
          ? "match_id"
          : "id";
    let query = client.from(table).select("*").order(order);
    if (table === "deck_cards" || table === "match_rosters")
      query = query.order("card_id");
    if (table === "deck_variants") query = query.order("variant_id");
    if (table === "match_rosters") query = query.order("side");
    if (table === "match_prizes") query = query.order("slot");
    const { data, error } = await query.range(start, start + 999);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return rows;
}
export async function loadAppData(): Promise<{
  data?: AppData;
  error?: string;
  setup?: boolean;
}> {
  if (!hasEnvVars) return { setup: true };
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) redirect("/auth/login");
  try {
    const [cards, decks, deckCards, variants, matches, rosters, prizes] =
      await Promise.all([
        allRows<Card>(client, "cards"),
        allRows<Deck>(client, "decks"),
        allRows<DeckCard>(client, "deck_cards"),
        allRows<Variant>(client, "deck_variants"),
        allRows<Match>(client, "matches"),
        allRows<Roster>(client, "match_rosters"),
        allRows<Prize>(client, "match_prizes"),
      ]);
    await Promise.all(
      decks.map(async (deck) => {
        if (!deck.image_path) return;
        const { data } = await client.storage
          .from("deck-images")
          .createSignedUrl(deck.image_path, 3600);
        if (data) deck.image_url = data.signedUrl;
      }),
    );
    decks.sort((a, b) => a.name.localeCompare(b.name));
    cards.sort((a, b) => a.name.localeCompare(b.name));
    return {
      data: { cards, decks, deckCards, variants, matches, rosters, prizes },
    };
  } catch (error) {
    console.error("Unable to load TCGL Helper data", error);
    return {
      error:
        "We could not load your data. Check your connection and make sure the Supabase schema has been installed, then try again.",
    };
  }
}
