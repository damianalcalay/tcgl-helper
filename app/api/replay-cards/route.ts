import { resolveLogCard } from "@/lib/tcgdex";
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
    return Response.json({ cards });
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
