import { resolveLogCard } from "@/lib/tcgdex";
import { manualImages } from "@/lib/card-images";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (
      !Array.isArray(body.names) ||
      body.names.length > 12 ||
      body.names.some((n: unknown) => typeof n !== "string" || n.length > 150)
    )
      return Response.json({ error: "Invalid names" }, { status: 400 });
    const cards = await Promise.all(
      body.names.map(async (name: string) => {
        try {
          return await resolveLogCard(name);
        } catch {
          return { name };
        }
      }),
    );
    const overrides = await manualImages(
      cards.flatMap((c) =>
        "id" in c && typeof c.id === "string" ? [c.id] : [],
      ),
    );
    return Response.json({
      cards: cards.map((c) =>
        "id" in c && typeof c.id === "string" && overrides.has(c.id)
          ? { ...c, image: overrides.get(c.id) }
          : c,
      ),
    });
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
