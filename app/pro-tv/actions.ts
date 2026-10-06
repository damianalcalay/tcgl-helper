"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { combineCombatLogs, parseCombatLog } from "@/lib/domain/combat-log";
import type { ProMatch } from "@/lib/pro-tv";

async function adminClient() {
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  const { data: admin, error } = await client.rpc("is_app_admin");
  if (!auth.user || error || !admin)
    throw new Error("Administrator access required.");
  return client;
}
export async function saveProMatch(input: Partial<ProMatch>) {
  try {
    const client = await adminClient();
    for (const key of [
      "title",
      "player",
      "opponent",
      "deck_name",
      "opponent_deck_name",
      "event",
      "round",
    ] as const)
      if (
        typeof input[key] !== "string" ||
        input[key]!.length > 150 ||
        (["title", "player", "opponent"].includes(key) && !input[key]!.trim())
      )
        throw new Error("Enter valid title, players and match details.");
    if (
      !Number.isInteger(input.game_number) ||
      input.game_number! < 1 ||
      input.game_number! > 99
    )
      throw new Error("Choose a game number from 1 to 99.");
    if (
      typeof input.published !== "boolean" ||
      typeof input.combat_log !== "string" ||
      typeof input.opponent_combat_log !== "string" ||
      typeof input.thumbnail !== "string" ||
      input.thumbnail.length > 2000
    )
      throw new Error("Invalid match data.");
    if (input.thumbnail) {
      const url = new URL(input.thumbnail);
      if (url.protocol !== "https:")
        throw new Error("Use an HTTPS thumbnail URL.");
    }
    const parsed = parseCombatLog(input.combat_log);
    if (
      !parsed.players.includes(input.player!) ||
      !parsed.players.includes(input.opponent!) ||
      input.player === input.opponent
    )
      throw new Error("Players must match the combat log.");
    if (input.opponent_combat_log) {
      const pair = combineCombatLogs(
        input.combat_log,
        input.opponent_combat_log,
      );
      if (pair.status !== "matched") throw new Error(pair.message);
    }
    if (input.published && !parsed.winner)
      throw new Error(
        "A published match requires a complete log with a result.",
      );
    const payload = {
      title: input.title,
      player: input.player,
      opponent: input.opponent,
      deck_name: input.deck_name,
      opponent_deck_name: input.opponent_deck_name,
      event: input.event,
      round: input.round,
      game_number: input.game_number,
      thumbnail: input.thumbnail,
      combat_log: input.combat_log,
      opponent_combat_log: input.opponent_combat_log,
      published: input.published,
    };
    const query = input.id
      ? client.from("pro_tv_matches").update(payload).eq("id", input.id)
      : client.from("pro_tv_matches").insert(payload);
    const { error } = await query.select("id").single();
    if (error) throw error;
    revalidatePath("/pro-tv");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not save match.",
    };
  }
}
export async function deleteProMatch(id: string) {
  try {
    const client = await adminClient();
    const { error } = await client
      .from("pro_tv_matches")
      .delete()
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/pro-tv");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not delete match.",
    };
  }
}
export async function setProTvEnabled(enabled: boolean) {
  try {
    if (typeof enabled !== "boolean") throw new Error("Invalid setting");
    const client = await adminClient();
    const { error } = await client
      .from("pro_tv_settings")
      .update({ enabled })
      .eq("id", true);
    if (error) throw error;
    revalidatePath("/pro-tv");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not update catalogue.",
    };
  }
}
