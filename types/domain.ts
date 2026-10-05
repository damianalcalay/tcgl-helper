const LEGACY_CARD_TYPES = {
  basic: "Basic",
  basic_ex: "Basic ex",
  mega_basic_ex: "Mega Basic ex",
  stage_1: "Stage 1",
  stage_1_ex: "Stage 1 ex",
  mega_stage_1_ex: "Mega Stage 1 ex",
  stage_2: "Stage 2",
  stage_2_ex: "Stage 2 ex",
  mega_stage_2_ex: "Mega Stage 2 ex",
  supporter: "Supporter",
  stadium: "Stadium",
  tool: "Pokémon Tool",
  item: "Item",
  ace_spec: "ACE SPEC",
  energy: "Energy",
} as const;
export const TCGDEX_STAGES = {
  basic: "Basic",
  stage_1: "Stage1",
  stage_2: "Stage2",
  baby: "Baby",
  break: "BREAK",
  level_up: "LEVEL-UP",
  mega: "MEGA",
  restored: "RESTORED",
  v_union: "V-UNION",
  vmax: "VMAX",
  vstar: "VSTAR",
} as const;
export const TCGDEX_SUFFIXES = {
  ex: "ex",
  upper_ex: "EX",
  gx: "GX",
  legend: "Legend",
  prime: "Prime",
  sp: "SP",
  tag_team_gx: "TAG TEAM-GX",
  v: "V",
} as const;
export const TCGDEX_TRAINERS = {
  item: "Item",
  supporter: "Supporter",
  stadium: "Stadium",
  tool: "Tool",
  rocket_secret_machine: "Rocket's Secret Machine",
  technical_machine: "Technical Machine",
} as const;
export type StageKey = keyof typeof TCGDEX_STAGES;
export type SuffixKey = keyof typeof TCGDEX_SUFFIXES;
export type CardType =
  | keyof typeof LEGACY_CARD_TYPES
  | StageKey
  | `${StageKey}_${SuffixKey}`
  | keyof typeof TCGDEX_TRAINERS
  | "energy_basic"
  | "energy_special";
export const CARD_TYPES = { ...LEGACY_CARD_TYPES } as Record<CardType, string>;
for (const [stage, label] of Object.entries(TCGDEX_STAGES)) {
  CARD_TYPES[stage as CardType] = label;
  for (const [suffix, suffixLabel] of Object.entries(TCGDEX_SUFFIXES))
    CARD_TYPES[`${stage}_${suffix}` as CardType] = `${label} ${suffixLabel}`;
}
Object.assign(CARD_TYPES, TCGDEX_TRAINERS, {
  energy_basic: "Energy · Normal (Basic)",
  energy_special: "Energy · Special",
});
export const BASIC_TYPES: CardType[] = [
  "basic",
  ...Object.keys(TCGDEX_SUFFIXES).map((s) => `basic_${s}` as CardType),
  "mega_basic_ex",
];
export function unlimitedEnergy(type: string) {
  return type === "energy" || type === "energy_basic";
}
export interface Card {
  id: string;
  name: string;
  type: CardType;
  created_at: string;
  updated_at: string;
}
export interface DeckCard {
  deck_id: string;
  card_id: string;
  quantity: number;
  printings?: CardPrinting[];
}
export interface CardPrinting {
  quantity: number;
  set_code: string;
  collector_number: string;
  tcgdex_id?: string;
  set_id?: string;
  set_name?: string;
  series_name?: string;
  regulation_mark?: string;
  image_url?: string;
  manual_image_path?: string;
  resolved_type?: CardType;
}
export interface Deck {
  id: string;
  name: string;
  playstyle: string;
  notes: string;
  image_path: string | null;
  image_url?: string;
  created_at: string;
  updated_at: string;
}
export interface Variant {
  deck_id: string;
  variant_id: string;
}
export type Result = "win" | "loss" | "draw";
export interface Match {
  combat_log?: string;
  log_player?: string;
  coin_won?: boolean | null;
  card_back?: string;
  opponent_card_back?: string;
  id: string;
  deck_id: string;
  opponent_deck_id: string;
  deck_name: string;
  opponent_deck_name: string;
  result: Result;
  my_prizes: number;
  opponent_prizes: number;
  starter_id: string;
  opponent_starter_id: string;
  played_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}
export interface Roster {
  printings?: CardPrinting[];
  match_id: string;
  side: "mine" | "opponent";
  card_id: string;
  card_name: string;
  card_type: CardType;
  quantity: number;
}
export interface Prize {
  match_id: string;
  slot: number;
  card_id: string;
}
export interface AppData {
  cards: Card[];
  decks: Deck[];
  deckCards: DeckCard[];
  variants: Variant[];
  matches: Match[];
  rosters: Roster[];
  prizes: Prize[];
}
export interface DeckInput {
  id?: string;
  name: string;
  playstyle: string;
  notes: string;
  image_path: string | null;
  cards: { card_id: string; quantity: number; printings?: CardPrinting[] }[];
  variants: string[];
  new_cards?: { id: string; name: string; type: CardType }[];
}
export interface MatchInput {
  combat_log?: string;
  log_player?: string;
  card_back?: string;
  opponent_card_back?: string;
  id?: string;
  deck_id: string;
  opponent_deck_id: string;
  result: Result;
  my_prizes: number;
  opponent_prizes: number;
  starter_id: string;
  opponent_starter_id: string;
  played_at: string;
  notes: string;
  prizes: string[];
}
export interface CardOption {
  id: string;
  name: string;
  type: CardType;
  quantity: number;
  printings?: CardPrinting[];
}
