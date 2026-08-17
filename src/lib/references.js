/**
 * Ordering of a species' reference appendix.
 *
 * The two automatic taxonomic sources come first, in the order they are consulted
 * — GBIF resolves the taxon, IUCN assesses it — and everything the curator added
 * follows alphabetically. The list is sorted wherever it is shown or saved, so it
 * never has to be arranged by hand.
 */

const rank = (ref) => {
  const url = (ref?.url || '').toLowerCase();
  if (url.includes('gbif.org')) return 0;
  if (url.includes('iucnredlist.org')) return 1;
  return 2;
};

/**
 * Sort key for a citation: Markdown emphasis and leading punctuation are stripped
 * so `*Título*` files under T rather than under the asterisk.
 */
const sortKey = (ref) => (ref?.citation || '')
  .replace(/[*_`]/g, '')
  .replace(/^[^\p{L}\p{N}]+/u, '')
  .trim();

/** A new array ordered GBIF, IUCN, then the rest alphabetically. */
export function sortReferences(references) {
  if (!Array.isArray(references)) return [];
  return [...references].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    // Spanish collation, insensitive to case and accents, so "Ávila" sorts with "A".
    return sortKey(a).localeCompare(sortKey(b), 'es', { sensitivity: 'base', numeric: true });
  });
}
