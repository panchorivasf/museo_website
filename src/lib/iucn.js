/**
 * Global IUCN Red List category for a species, and the citation that backs it.
 *
 * The official IUCN Red List API requires a per-user token, so the category is
 * read from GBIF's public mirror of the Red List checklist
 * (`/species/{usageKey}/iucnRedListCategory`) — same source data, no credentials.
 * The citation credits IUCN and records that it was consulted through GBIF.
 */

const IUCN_CATEGORY_ENDPOINT = (usageKey) => `https://api.gbif.org/v1/species/${usageKey}/iucnRedListCategory`;
const IUCN_SEARCH = 'https://www.iucnredlist.org/search?searchType=species&query=';

/** Red List categories, in the order IUCN presents them (most at risk first). */
export const IUCN_CATEGORIES = [
  { value: 'EX', label: 'EX — Extinta' },
  { value: 'EW', label: 'EW — Extinta en Estado Silvestre' },
  { value: 'CR', label: 'CR — En Peligro Crítico' },
  { value: 'EN', label: 'EN — En Peligro' },
  { value: 'VU', label: 'VU — Vulnerable' },
  { value: 'NT', label: 'NT — Casi Amenazada' },
  { value: 'LC', label: 'LC — Preocupación Menor' },
  { value: 'DD', label: 'DD — Datos Insuficientes' },
  { value: 'NE', label: 'NE — No Evaluada' },
];

export const iucnLabel = (code) =>
  IUCN_CATEGORIES.find(c => c.value === code)?.label.split(' — ')[1] || '';

export const iucnSearchUrl = (scientificName) => `${IUCN_SEARCH}${encodeURIComponent(scientificName)}`;

/**
 * The Red List entry for a GBIF taxon, or null when the species carries no
 * assessment. "Not Evaluated" is not an assessment: it has no taxon ID and
 * nothing to cite, so it is reported as absent rather than stored as a result.
 */
export async function fetchIucnAssessment(usageKey) {
  const res = await fetch(IUCN_CATEGORY_ENDPOINT(usageKey));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`IUCN (vía GBIF) respondió ${res.status}`);
  const data = await res.json();
  if (!data?.code || data.code === 'NE' || !data.iucnTaxonID) return null;
  return data;
}

/** True when the list already cites the Red List, so it is never added twice. */
export function hasIucnReference(references) {
  return (Array.isArray(references) ? references : [])
    .some(ref => (ref?.url || '').includes('iucnredlist.org'));
}

/**
 * The reference entry for an assessment, in the shape the appendix renders.
 * `searchName` should be the canonical binomial: the Red List search does not
 * match the authorship that IUCN's own `scientificName` carries.
 */
export function buildIucnReference(assessment, { now = new Date(), searchName } = {}) {
  const name = assessment.scientificName;
  const accessed = now.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  const label = iucnLabel(assessment.code);
  return {
    citation: `IUCN (${now.getFullYear()}). ${name}: ${label} (${assessment.code}). `
      + `*The IUCN Red List of Threatened Species*, taxón ${assessment.iucnTaxonID}. `
      + `Consultado el ${accessed} vía GBIF.`,
    url: iucnSearchUrl(searchName || name),
    url_label: 'Ver en IUCN Red List',
  };
}
