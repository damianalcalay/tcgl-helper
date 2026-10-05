import {
  TCGDEX_STAGES,
  TCGDEX_SUFFIXES,
  TCGDEX_TRAINERS,
  type CardPrinting,
  type CardType,
} from "@/types/domain";
import type { ImportedCard } from "@/lib/domain/deck-import";

const API = "https://api.tcgdex.net/v2/en";
// TCG Live abbreviations differ from TCGdex set IDs.
const SETS: Record<string, string> = {
  SVI: "sv01",
  PAL: "sv02",
  OBF: "sv03",
  MEW: "sv03.5",
  PAR: "sv04",
  PAF: "sv04.5",
  TEF: "sv05",
  TWM: "sv06",
  SFA: "sv06.5",
  SCR: "sv07",
  SSP: "sv08",
  PRE: "sv08.5",
  JTG: "sv09",
  DRI: "sv10",
  BLK: "sv10.5b",
  WHT: "sv10.5w",
  MEG: "me01",
  PFL: "me02",
  ASC: "me02.5",
  POR: "me03",
  SWSH: "swshp",
  SVP: "svp",
  MEP: "mep",
  SVE: "sve",
  MEE: "mee",
  SSH: "swsh1",
  RCL: "swsh2",
  DAA: "swsh3",
  CPA: "swsh3.5",
  VIV: "swsh4",
  SHF: "swsh4.5",
  BST: "swsh5",
  CRE: "swsh6",
  EVS: "swsh7",
  CEL: "cel25",
  FST: "swsh8",
  BRS: "swsh9",
  ASR: "swsh10",
  PGO: "pgo",
  LOR: "swsh11",
  SIT: "swsh12",
  CRZ: "swsh12.5",
  SUM: "sm1",
  GRI: "sm2",
  BUS: "sm3",
  SLG: "sm3.5",
  CIN: "sm4",
  UPR: "sm5",
  FLI: "sm6",
  CES: "sm7",
  DRM: "sm7.5",
  LOT: "sm8",
  TEU: "sm9",
  DET: "det1",
  UNB: "sm10",
  UNM: "sm11",
  HIF: "sm11.5",
  CEC: "sm12",
  PR: "smp",
};
interface SetData {
  id: string;
  name: string;
  serie?: { name: string };
  cards: { id: string; localId: string | number; name: string }[];
}
interface CardData {
  id: string;
  localId: string | number;
  name: string;
  image?: string;
  regulationMark?: string;
  category: string;
  stage?: string;
  suffix?: string;
  trainerType?: string;
  rarity?: string;
  energyType?: string;
}
export function cardType(card: CardData): CardType | undefined {
  const normalize = (value?: string) =>
    value
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[\s_-]/g, "");
  const category = normalize(card.category);
  if (category === "energy")
    return card.energyType === "Special" ? "energy_special" : "energy_basic";
  if (category === "trainer") {
    if (/ace spec/i.test(card.rarity ?? "")) return "ace_spec";
    if (normalize(card.trainerType) === "pokemontool") return "tool";
    return Object.entries(TCGDEX_TRAINERS).find(
      ([, label]) => normalize(label) === normalize(card.trainerType),
    )?.[0] as CardType | undefined;
  }
  if (category !== "pokemon") return undefined;
  const stage = Object.entries(TCGDEX_STAGES).find(
    ([, label]) => normalize(label) === normalize(card.stage),
  )?.[0];
  if (!stage) return undefined;
  if (!card.suffix) return stage as CardType;
  const suffix = Object.entries(TCGDEX_SUFFIXES).find(
    ([, label]) => label === card.suffix,
  )?.[0];
  return suffix ? ((stage + "_" + suffix) as CardType) : undefined;
}
const normalNumber = (value: string | number) =>
  String(value)
    .replace(/^0+(?=\d)/, "")
    .toLowerCase();
async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`TCGdex returned ${response.status}`);
  return response.json();
}
export async function enrichDeck(cards: ImportedCard[]) {
  const sets = new Map<string, Promise<SetData>>();
  const warnings: string[] = [];
  const result: ImportedCard[] = [];
  async function resolveEntry(entry: ImportedCard): Promise<ImportedCard> {
    const printings: CardPrinting[] = [];
    for (const printing of entry.printings) {
      try {
        const setId =
          SETS[printing.set_code] ?? printing.set_code.toLowerCase();
        if (!sets.has(setId))
          sets.set(setId, get<SetData>(`sets/${encodeURIComponent(setId)}`));
        const set = await sets.get(setId)!;
        const brief = set.cards.find(
          (c) =>
            normalNumber(c.localId) === normalNumber(printing.collector_number),
        );
        if (!brief) throw new Error("Card number not found");
        const card = await get<CardData>(
          `cards/${encodeURIComponent(brief.id)}`,
        );
        const resolvedType = cardType(card);
        printings.push({
          ...printing,
          tcgdex_id: card.id,
          set_id: set.id,
          set_name: set.name,
          series_name: set.serie?.name,
          collector_number: String(card.localId),
          regulation_mark: card.regulationMark,
          image_url: card.image?.startsWith("https://assets.tcgdex.net/en/")
            ? `${card.image}/high.webp`
            : undefined,
          resolved_type: resolvedType,
        });
        if (!resolvedType)
          warnings.push(
            `TCGdex did not provide a supported type for ${entry.name} (${printing.set_code} ${printing.collector_number}). Choose its type below.`,
          );
        if (!card.image)
          warnings.push(
            `No image for ${entry.name} (${printing.set_code} ${printing.collector_number}).`,
          );
      } catch {
        printings.push(printing);
        warnings.push(
          `Could not resolve ${entry.name} (${printing.set_code} ${printing.collector_number}). Identifiers were kept; you can retry the import.`,
        );
      }
    }
    return { ...entry, printings };
  }
  // Three cards at a time; sets are shared across workers and cached by Next.
  for (let i = 0; i < cards.length; i += 3) {
    result.push(
      ...(await Promise.all(cards.slice(i, i + 3).map(resolveEntry))),
    );
  }
  return { cards: result, warnings };
}
