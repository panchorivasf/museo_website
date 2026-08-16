/**
 * GBIF lookups and the taxonomic-source reference every species carries.
 *
 * Species pages cite where their classification comes from; GBIF's backbone is
 * that source, so a reference to the matched species page is added when a species
 * is created (and can be backfilled for older records from the admin).
 */

const MATCH_ENDPOINT = 'https://api.gbif.org/v1/species/match?name=';
const SPECIES_PAGE = 'https://www.gbif.org/species/';

/** Look a scientific name up in the GBIF backbone. */
export async function matchGbifName(scientificName) {
  const res = await fetch(`${MATCH_ENDPOINT}${encodeURIComponent(scientificName)}`);
  if (!res.ok) throw new Error(`GBIF respondió ${res.status}`);
  return res.json();
}

/**
 * Whether a match actually identifies the name that was looked up. HIGHERRANK
 * means GBIF only resolved the genus or above, so its page would document a
 * different taxon than the species being cited.
 */
export function isUsableGbifMatch(match) {
  return !!match?.usageKey
    && !!match.matchType
    && match.matchType !== 'NONE'
    && match.matchType !== 'HIGHERRANK';
}

export const gbifSpeciesUrl = (usageKey) => `${SPECIES_PAGE}${usageKey}`;

/** True when the list already cites GBIF, so it is never added twice. */
export function hasGbifReference(references) {
  return (Array.isArray(references) ? references : [])
    .some(ref => (ref?.url || '').includes('gbif.org'));
}

/** The reference entry for a matched species, in the shape the appendix renders. */
export function buildGbifReference(match, { now = new Date() } = {}) {
  const name = match.scientificName || match.canonicalName;
  const accessed = now.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  return {
    citation: `GBIF Secretariat (${now.getFullYear()}). *GBIF Backbone Taxonomy*: ${name}. Checklist dataset, consultado el ${accessed}.`,
    url: gbifSpeciesUrl(match.usageKey),
    url_label: 'Ver en GBIF',
  };
}
