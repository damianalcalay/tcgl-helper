import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CardPrinting } from "@/types/domain";

/** Shared exact-printing overrides. Public reads also serve Pro TV. */
export async function manualImages(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const client = await createClient();
  const result = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await client
      .from("card_image_overrides")
      .select("tcgdex_id,path")
      .in("tcgdex_id", ids.slice(i, i + 150));
    // Older installations can still replay until the new migration is installed.
    if (error?.code === "42P01" || error?.code === "PGRST205") return result;
    if (error)
      throw new Error(
        "Could not load shared card images. Check the image-library migration and connection.",
      );
    for (const row of data ?? [])
      result.set(
        row.tcgdex_id,
        client.storage.from("card-art").getPublicUrl(row.path).data.publicUrl,
      );
  }
  return result;
}
export async function applyManualImages(printings: CardPrinting[]) {
  const overrides = await manualImages([
    ...new Set(printings.flatMap((p) => (p.tcgdex_id ? [p.tcgdex_id] : []))),
  ]);
  for (const p of printings)
    if (p.tcgdex_id && overrides.has(p.tcgdex_id))
      p.image_url = overrides.get(p.tcgdex_id);
}
