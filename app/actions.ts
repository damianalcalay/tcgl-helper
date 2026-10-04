"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CARD_TYPES, CardType, DeckInput, MatchInput } from "@/types/domain";
import { validateQuantities } from "@/lib/domain/logic";
export type ActionResult =
  { success: true; id?: string } | { success: false; error: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}
function name(value: unknown) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 150
  );
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.length <= 50000;
}
function fail(error: unknown): ActionResult {
  console.error("TCGL Helper mutation failed", error);
  const e = error as { code?: string; message?: string };
  if (e.code === "23503" || e.code === "23001")
    return {
      success: false,
      error:
        "This record is used by a deck or match. Remove those references first. Match history is protected.",
    };
  if (e.code === "PGRST116")
    return {
      success: false,
      error:
        "This record no longer exists. Refresh your workspace and try again.",
    };
  if (e.code === "23505")
    return {
      success: false,
      error:
        "This name or relationship already exists. Choose a different name or remove the duplicate.",
    };
  if (e.code === "23514" || e.code === "22P02")
    return {
      success: false,
      error:
        "Some values are outside the allowed range. Please check your form.",
    };
  if (e.code === "P0001")
    return { success: false, error: e.message ?? "Please check your form." };
  return {
    success: false,
    error:
      "Unable to save your changes. Check your connection and Supabase setup, then try again.",
  };
}
async function authenticated() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw {
      code: "P0001",
      message: "Your session has expired. Sign in again.",
    };
  return client;
}
function refresh() {
  ["/decks", "/notebook", "/stats"].forEach((path) => revalidatePath(path));
}
export async function saveCard(input: {
  id?: string;
  name: string;
  type: CardType;
}): Promise<ActionResult> {
  if (
    !input ||
    !name(input.name) ||
    !Object.hasOwn(CARD_TYPES, input.type) ||
    (input.id && !id(input.id))
  )
    return {
      success: false,
      error: "Enter a card name and select a valid card type.",
    };
  try {
    const client = await authenticated();
    const fields = { name: input.name.trim(), type: input.type };
    const query = input.id
      ? client.from("cards").update(fields).eq("id", input.id)
      : client.from("cards").insert(fields);
    const { data, error } = await query.select("id").single();
    if (error) throw error;
    refresh();
    return { success: true, id: data.id };
  } catch (error) {
    return fail(error);
  }
}
export async function saveDeck(input: DeckInput): Promise<ActionResult> {
  if (
    !input ||
    !name(input.name) ||
    !text(input.playstyle) ||
    !text(input.notes) ||
    (input.id && !id(input.id)) ||
    !Array.isArray(input.cards) ||
    !Array.isArray(input.variants) ||
    input.cards.some((c) => !c || !id(c.card_id)) ||
    input.variants.some((v) => !id(v)) ||
    (input.image_path !== null && typeof input.image_path !== "string")
  )
    return { success: false, error: "Check the deck name and selected cards." };
  const error = validateQuantities(input.cards);
  if (error) return { success: false, error };
  if (
    new Set(input.variants).size !== input.variants.length ||
    input.variants.includes(input.id ?? "")
  )
    return {
      success: false,
      error: "Variants must be unique and cannot include this deck.",
    };
  try {
    const client = await authenticated();
    const { data, error } = await client.rpc("save_deck", { payload: input });
    if (error) throw error;
    refresh();
    return { success: true, id: data };
  } catch (error) {
    return fail(error);
  }
}
export async function saveMatch(input: MatchInput): Promise<ActionResult> {
  if (
    !input ||
    (input.id && !id(input.id)) ||
    ![
      input.deck_id,
      input.opponent_deck_id,
      input.starter_id,
      input.opponent_starter_id,
    ].every(id) ||
    !["win", "loss", "draw"].includes(input.result) ||
    ![input.my_prizes, input.opponent_prizes].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 6,
    ) ||
    !Array.isArray(input.prizes) ||
    input.prizes.length > 6 ||
    !input.prizes.every(id) ||
    typeof input.played_at !== "string" ||
    !Number.isFinite(Date.parse(input.played_at)) ||
    !text(input.notes)
  )
    return {
      success: false,
      error:
        "Select both decks and Basic starters, a valid date, and prize counts from 0 to 6.",
    };
  try {
    const client = await authenticated();
    const { data, error } = await client.rpc("save_match", { payload: input });
    if (error) throw error;
    refresh();
    return { success: true, id: data };
  } catch (error) {
    return fail(error);
  }
}
export async function deleteEntity(
  entity: "deck" | "card" | "match",
  entityId: string,
): Promise<ActionResult> {
  if (!["deck", "card", "match"].includes(entity) || !id(entityId))
    return { success: false, error: "Record not found." };
  try {
    const client = await authenticated();
    const { error } = await client.rpc("delete_entity", {
      entity,
      entity_id: entityId,
    });
    if (error) throw error;
    refresh();
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}
