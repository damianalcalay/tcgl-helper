/** TCGdex currently omits the Tera rule on many cards. Printing-specific fallback,
 * never inferred from “ex”, typing, or the Pokémon's name alone.
 * Snapshot: github.com/PokemonTCG/pokemon-tcg-data cards/en, subtypes=Tera,
 * retrieved 2026-10-06. Empty/new sets remain unknown and can be confirmed in setup. */
const teraPrintings: Record<string, string[]> = {
  sv03: [
    "042",
    "066",
    "096",
    "125",
    "159",
    "179",
    "210",
    "211",
    "212",
    "215",
    "222",
    "223",
    "228",
  ],
  sv04: [
    "003",
    "038",
    "046",
    "058",
    "098",
    "100",
    "137",
    "217",
    "219",
    "220",
    "226",
    "227",
    "245",
    "260",
  ],
  "sv04.5": ["002", "006", "054", "212", "214", "234"],
  sv05: ["060", "108", "190", "194"],
  sv06: [
    "025",
    "029",
    "040",
    "064",
    "106",
    "112",
    "130",
    "190",
    "191",
    "192",
    "194",
    "198",
    "199",
    "200",
    "211",
    "212",
    "213",
    "214",
    "215",
    "221",
  ],
  "sv06.5": ["015", "081"],
  sv07: ["028", "032", "051", "128", "157", "158", "159", "168", "170", "173"],
  sv08: [
    "036",
    "057",
    "086",
    "091",
    "106",
    "119",
    "133",
    "142",
    "159",
    "219",
    "221",
    "222",
    "223",
    "225",
    "226",
    "228",
    "238",
    "240",
    "242",
    "247",
    "248",
  ],
  "sv08.5": [
    "006",
    "012",
    "014",
    "017",
    "023",
    "026",
    "027",
    "028",
    "030",
    "034",
    "041",
    "058",
    "060",
    "073",
    "075",
    "144",
    "145",
    "146",
    "147",
    "148",
    "149",
    "150",
    "152",
    "153",
    "155",
    "156",
    "160",
    "161",
    "165",
    "167",
    "169",
    "177",
    "179",
    "180",
  ],
  sv09: [],
  sv10: [],
  "sv10.5": [],
};
export function teraMetadata(card: {
  id: string;
  abilities?: { type?: string; name?: string }[];
  effect?: string;
}): boolean | undefined {
  if (
    card.abilities?.some((a) => a.type === "Tera" || a.name === "Tera") ||
    /^Tera\s*:/i.test(card.effect ?? "")
  )
    return true;
  const split = card.id.lastIndexOf("-");
  const set = card.id.slice(0, split),
    number = card.id.slice(split + 1).padStart(3, "0");
  return teraPrintings[set]?.length
    ? teraPrintings[set].includes(number)
    : undefined;
}
export function printingTera(printing?: {
  tera?: boolean;
  tcgdex_id?: string;
  set_id?: string;
  set_code?: string;
  collector_number?: string;
}) {
  if (!printing) return undefined;
  if (printing.tera !== undefined) return printing.tera;
  const sets: Record<string, string> = {
    OBF: "sv03",
    PAR: "sv04",
    PAF: "sv04.5",
    TEF: "sv05",
    TWM: "sv06",
    SFA: "sv06.5",
    SCR: "sv07",
    SSP: "sv08",
    PRE: "sv08.5",
  };
  const set = printing.set_id ?? sets[printing.set_code ?? ""];
  const id =
    printing.tcgdex_id ??
    (set && printing.collector_number
      ? `${set}-${printing.collector_number}`
      : undefined);
  return id ? teraMetadata({ id }) : undefined;
}
