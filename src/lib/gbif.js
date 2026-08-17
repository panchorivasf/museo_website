/**
 * GBIF lookups and the taxonomic-source reference every species carries.
 *
 * Species pages cite where their classification comes from; GBIF's backbone is
 * that source, so a reference to the matched species page is added when a species
 * is created (and can be backfilled for older records from the admin).
 */

const API = 'https://api.gbif.org/v1/species';
const MATCH_ENDPOINT = `${API}/match?name=`;
const SPECIES_PAGE = 'https://www.gbif.org/species/';

// The GBIF Backbone Taxonomy. Searches are restricted to it so candidates are
// backbone usages — the ones the match endpoint and the Red List mirror speak in.
const BACKBONE_DATASET = 'd7dddbf4-2cf0-4f39-9b2a-bb099caae36c';

/** GBIF class keys for the taxa this site catalogues, used to filter candidates. */
export const GBIF_CLASS_BY_TAXON = {
  aves: { key: 212, label: 'Aves' },
  insectos: { key: 216, label: 'Insecta' },
  anfibios: { key: 131, label: 'Amphibia' },
  cetaceos: { key: 359, label: 'Mammalia' },
  mamiferos_terrestres: { key: 359, label: 'Mammalia' },
  felinos: { key: 359, label: 'Mammalia' },
};

/** Look a scientific name up in the GBIF backbone. */
export async function matchGbifName(scientificName) {
  const res = await fetch(`${MATCH_ENDPOINT}${encodeURIComponent(scientificName)}`);
  if (!res.ok) throw new Error(`GBIF respondió ${res.status}`);
  return res.json();
}

/** A single backbone usage by key. */
export async function fetchGbifUsage(usageKey) {
  const res = await fetch(`${API}/${usageKey}`);
  if (!res.ok) throw new Error(`GBIF respondió ${res.status}`);
  return res.json();
}

/** The specific epithet of a binomial ("Rhopospina fruticeti" -> "fruticeti"). */
export function specificEpithet(scientificName) {
  const parts = (scientificName || '').trim().split(/\s+/);
  return parts.length >= 2 ? parts[1] : '';
}

/**
 * Backbone species sharing an epithet within one class — the way to find the taxon
 * when GBIF places it in a different genus than the authority used here. Synonyms
 * are included on purpose: they are usually the bridge between the two names.
 */
export async function searchGbifByEpithet(epithet, classKey, { limit = 20 } = {}) {
  const params = new URLSearchParams({
    q: epithet,
    rank: 'SPECIES',
    datasetKey: BACKBONE_DATASET,
    limit: String(limit),
  });
  if (classKey) params.set('higherTaxonKey', String(classKey));
  const res = await fetch(`${API}/search?${params}`);
  if (!res.ok) throw new Error(`GBIF respondió ${res.status}`);
  const data = await res.json();
  // The search matches anywhere in the name; keep only true epithet matches.
  const wanted = epithet.toLowerCase();
  return (data.results || []).filter(r => specificEpithet(r.canonicalName).toLowerCase() === wanted);
}

/**
 * The accepted usage behind a candidate. Picking a synonym is expected — it is how
 * the admin's name maps onto GBIF — but data must be read from the accepted taxon,
 * whose Red List entry carries the real assessment id rather than a synonym alias.
 */
export async function resolveAcceptedUsage(usage) {
  if (!usage?.acceptedKey || usage.acceptedKey === usage.key) return usage;
  return fetchGbifUsage(usage.acceptedKey);
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

/**
 * One shape for both GBIF payloads: `/species/match` calls the id `usageKey` and
 * the status `status`, while `/species/{key}` calls them `key` and `taxonomicStatus`.
 */
export function normalizeGbifTaxon(source) {
  if (!source) return null;
  return {
    key: source.usageKey ?? source.key,
    scientificName: source.scientificName,
    canonicalName: source.canonicalName,
    order: source.order,
    family: source.family,
    status: source.taxonomicStatus || source.status,
    acceptedKey: source.acceptedKey,
  };
}

/**
 * Note appended to a citation when this site's name for the species differs from
 * the one the source uses, so a reader can see that the two names are the same
 * taxon rather than suspecting the wrong record was cited.
 */
export function equivalenceNote(sourceName, siteName) {
  const canonical = (n) => (n || '').trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase();
  if (!siteName || !sourceName || canonical(sourceName) === canonical(siteName)) return '';
  return ` [= ${siteName.trim()}, nombre usado en este sitio]`;
}

/** The reference entry for a matched species, in the shape the appendix renders. */
export function buildGbifReference(taxon, { now = new Date(), siteName } = {}) {
  const name = taxon.scientificName || taxon.canonicalName;
  const accessed = now.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  return {
    citation: `GBIF Secretariat (${now.getFullYear()}). *GBIF Backbone Taxonomy*: ${name}`
      + `${equivalenceNote(name, siteName)}. Checklist dataset, consultado el ${accessed}.`,
    url: gbifSpeciesUrl(taxon.key),
    url_label: 'Ver en GBIF',
  };
}
