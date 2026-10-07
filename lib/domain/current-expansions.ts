/** 2026 Standard rotation: H onwards. H starts with Temporal Forces (sv05).
 * https://www.pokemon.com/uk/news/2026-pokemon-tcg-standard-format-rotation-announcement
 * Expansion availability does not certify every card's individual legality.
 */
export function currentExpansionId(id: string) {
  const scarlet = /^sv(\d+)(?:\.\d+[a-z]?)?$/.exec(id);
  return Boolean(
    (scarlet && Number(scarlet[1]) >= 5) || /^me\d+(?:\.\d+[a-z]?)?$/.test(id),
  );
}
export function releasedExpansion(releaseDate: string, now = Date.now()) {
  const release = Date.parse(releaseDate);
  return Number.isFinite(release) && release + 14 * 86400000 <= now;
}
