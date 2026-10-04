export const CARD_TYPES = {
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
export type CardType = keyof typeof CARD_TYPES;
export const BASIC_TYPES: CardType[] = ["basic", "basic_ex", "mega_basic_ex"];
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
  cards: { card_id: string; quantity: number }[];
  variants: string[];
  new_cards?: { id: string; name: string; type: CardType }[];
}
export interface MatchInput {
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
}
