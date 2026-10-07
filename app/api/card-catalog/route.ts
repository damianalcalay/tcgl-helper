import {
  cardType,
  catalogPrinting,
  tcgdexGet,
  type CardData,
} from "@/lib/tcgdex";
import { applyManualImages, manualImages } from "@/lib/card-images";
import { createClient } from "@/lib/supabase/server";
import {
  currentExpansionId,
  releasedExpansion,
} from "@/lib/domain/current-expansions";
import { Script } from "node:vm";

type Brief = { id: string; name: string; localId: string };
let cachedCards: { cards: Brief[]; expires: number } | undefined;
let pendingCards: Promise<Brief[]> | undefined;
async function standardCards() {
  if (cachedCards && cachedCards.expires > Date.now()) return cachedCards.cards;
  if (!pendingCards)
    pendingCards = loadStandardCards()
      .then((cards) => {
        cachedCards = { cards, expires: Date.now() + 86400000 };
        return cards;
      })
      .finally(() => {
        pendingCards = undefined;
      });
  return pendingCards;
}
async function loadStandardCards() {
  // Nested legality filters are not consistently supported by the brief-card endpoint.
  const [cards, sets] = await Promise.all([
    tcgdexGet<Brief[]>("cards"),
    tcgdexGet<{ id: string; name: string }[]>("sets"),
  ]);
  const eligible = sets.filter((s) => currentExpansionId(s.id));
  const released = new Set<string>(["sve", "mee"]);
  for (let i = 0; i < eligible.length; i += 5) {
    const details = await Promise.all(
      eligible
        .slice(i, i + 5)
        .map((s) =>
          tcgdexGet<{ id: string; releaseDate: string }>(`sets/${s.id}`),
        ),
    );
    for (const s of details)
      if (releasedExpansion(s.releaseDate)) released.add(s.id);
  }
  return cards.filter((c) =>
    released.has(c.id.slice(0, c.id.lastIndexOf("-"))),
  );
}

export async function GET(request: Request) {
  const client = await createClient();
  if (!(await client.auth.getUser()).data.user)
    return Response.json(
      { error: "Sign in to browse cards." },
      { status: 401 },
    );
  const params = new URL(request.url).searchParams;
  try {
    const id = params.get("id"),
      set = params.get("set");
    if (
      (id && !/^[a-zA-Z0-9.-]{1,80}$/.test(id)) ||
      (set && !/^[a-zA-Z0-9.-]{1,40}$/.test(set))
    )
      return Response.json({ error: "Invalid identifier" }, { status: 400 });
    if (id) {
      const card = await tcgdexGet<CardData>(`cards/${id}`);
      const printing = catalogPrinting(card);
      await applyManualImages([printing]);
      return Response.json({
        name:
          card.suffix && !card.name.endsWith(` ${card.suffix}`)
            ? `${card.name} ${card.suffix}`
            : card.name,
        type: cardType(card),
        printing,
      });
    }
    if (params.has("sets")) {
      const all = await tcgdexGet<{ id: string; name: string }[]>("sets");
      const candidates = all.filter((s) => currentExpansionId(s.id));
      const sets: { id: string; name: string; releaseDate: string }[] = [];
      for (let i = 0; i < candidates.length; i += 5) {
        sets.push(
          ...(await Promise.all(
            candidates
              .slice(i, i + 5)
              .map((s) =>
                tcgdexGet<{ id: string; name: string; releaseDate: string }>(
                  `sets/${s.id}`,
                ),
              ),
          )),
        );
      }
      return Response.json({
        sets: sets
          .filter((s) => releasedExpansion(s.releaseDate))
          .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
          .map((s) => ({ id: s.id, name: s.name, releaseDate: s.releaseDate })),
        source: "2026 Standard expansion pool · H onwards · newest first",
      });
    }
    if (set) {
      const data = await tcgdexGet<{
        id: string;
        name: string;
        cards: { id: string; name: string; localId: string; image?: string }[];
      }>(`sets/${set}`);
      const overrides = await manualImages(data.cards.map((c) => c.id));
      return Response.json({
        name: data.name,
        cards: data.cards.map((c) => ({
          ...c,
          image:
            overrides.get(c.id) ??
            (c.image ? `${c.image}/high.webp` : undefined),
          manual: overrides.has(c.id),
        })),
      });
    }
    const query = params.get("q");
    if (query !== null) {
      if (!query.trim()) return Response.json({ cards: [] });
      if (query.length > 120)
        return Response.json(
          { error: "Use at most 120 characters." },
          { status: 400 },
        );
      try {
        new RegExp(query, "i");
      } catch {
        return Response.json(
          { error: "Invalid regular expression." },
          { status: 400 },
        );
      }
      const rows = await standardCards();
      try {
        const matches = new Script(
          'const matcher = new RegExp(pattern, "i"); rows.filter(c => matcher.test(c.name + " · " + c.id)).slice(0, 80)',
        ).runInNewContext({ pattern: query, rows }, { timeout: 50 });
        return Response.json({
          cards: matches,
          limited: matches.length === 80,
        });
      } catch {
        return Response.json(
          { error: "This expression is too complex. Simplify the search." },
          { status: 400 },
        );
      }
    }
    return Response.json({
      cards: await standardCards(),
      source: "Current released Standard expansions",
    });
  } catch {
    return Response.json(
      {
        error:
          "The card catalog is temporarily unavailable. Retry; this does not mean the cards have no image.",
      },
      { status: 502 },
    );
  }
}
export async function POST(request: Request) {
  const client = await createClient();
  if (!(await client.auth.getUser()).data.user)
    return Response.json(
      { error: "Sign in to check card images." },
      { status: 401 },
    );
  try {
    const body = await request.json();
    if (
      !Array.isArray(body.ids) ||
      body.ids.length > 12 ||
      body.ids.some(
        (id: unknown) =>
          typeof id !== "string" || !/^[a-zA-Z0-9.-]{1,80}$/.test(id),
      )
    )
      return Response.json(
        { error: "Invalid card identifiers" },
        { status: 400 },
      );
    const overrides = await manualImages(body.ids);
    const cards: {
      id: string;
      status: "available" | "missing" | "unverified";
    }[] = [];
    for (let i = 0; i < body.ids.length; i += 4)
      cards.push(
        ...(await Promise.all(
          body.ids.slice(i, i + 4).map(async (id: string) => {
            if (overrides.has(id)) return { id, status: "available" as const };
            try {
              const card = await tcgdexGet<CardData>(`cards/${id}`);
              if (!card.image) return { id, status: "missing" as const };
              const url = catalogPrinting(card).image_url;
              if (!url) return { id, status: "unverified" as const };
              const response = await fetch(url, {
                method: "HEAD",
                redirect: "error",
                next: { revalidate: 86400 },
                signal: AbortSignal.timeout(10000),
              });
              return {
                id,
                status: response.ok
                  ? ("available" as const)
                  : response.status === 404
                    ? ("missing" as const)
                    : ("unverified" as const),
              };
            } catch {
              return { id, status: "unverified" as const };
            }
          }),
        )),
      );
    return Response.json({ cards });
  } catch {
    return Response.json(
      { error: "Image verification unavailable. Retry." },
      { status: 502 },
    );
  }
}
