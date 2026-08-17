import {
  buildGbifReference, fetchGbifUsage, hasGbifReference, isUsableGbifMatch,
  matchGbifName, normalizeGbifTaxon, resolveAcceptedUsage,
} from '@/lib/gbif';
import { buildIucnReference, fetchIucnAssessment, hasIucnReference } from '@/lib/iucn';

/**
 * The GBIF taxon to read this species from.
 *
 * A species linked to a GBIF taxon by key is read from that key: this site keeps
 * its own authority for `scientific_name` (Birds of the World, for instance),
 * while GBIF may place the species in another genus, and matching by name would
 * either fail or land on the wrong taxon. Everything else is matched by name.
 */
export async function resolveGbifTaxon(record) {
  if (record?.gbif_usage_key) {
    const usage = await resolveAcceptedUsage(await fetchGbifUsage(record.gbif_usage_key));
    return normalizeGbifTaxon(usage);
  }
  const name = record?.scientific_name?.trim();
  if (!name) throw new Error('sin nombre científico');
  const match = await matchGbifName(name);
  if (!isUsableGbifMatch(match)) {
    throw new Error(
      match?.matchType === 'HIGHERRANK'
        ? `GBIF solo reconoce «${match.canonicalName || ''}», no la especie`
        : 'sin coincidencia en GBIF',
    );
  }
  return normalizeGbifTaxon(match);
}

/**
 * Fills a species' external-source fields in one pass: the GBIF taxonomic-source
 * reference, and the global IUCN Red List category with its own citation.
 *
 * Both lookups hang off the same GBIF match, so a species costs one name lookup
 * plus one category lookup regardless of how much is missing.
 *
 * Returns `{ patch, notes }`. `patch` holds only the fields that should change —
 * it is empty when there is nothing to do, so callers can skip the write. `notes`
 * explains anything that was deliberately left alone (no GBIF match, no Red List
 * assessment), for surfacing in the admin.
 */
export async function enrichSpeciesFromSources(record, { now = new Date() } = {}) {
  const name = record?.scientific_name?.trim();
  const notes = [];
  if (!name) return { patch: {}, notes: ['sin nombre científico'] };

  const references = Array.isArray(record?.references) ? record.references : [];
  const needsGbifReference = !hasGbifReference(references);
  // Keyed on the stored category alone: a species recorded as Not Evaluated has
  // nothing to cite, and re-asking on every run would never converge.
  const needsIucn = !record?.iucn_global_status;
  if (!needsGbifReference && !needsIucn) return { patch: {}, notes };

  const taxon = await resolveGbifTaxon(record);

  const patch = {};
  let nextReferences = references;
  // Citations name the taxon as the source does, noting this site's name when the
  // two authorities disagree about the genus.
  const siteName = name;

  if (needsGbifReference) {
    nextReferences = [...nextReferences, buildGbifReference(taxon, { now, siteName })];
  }

  if (needsIucn) {
    const assessment = await fetchIucnAssessment(taxon.key);
    if (assessment) {
      patch.iucn_global_status = assessment.code;
      if (!hasIucnReference(nextReferences)) {
        nextReferences = [
          ...nextReferences,
          buildIucnReference(assessment, { now, searchName: taxon.canonicalName, siteName }),
        ];
      }
    } else {
      // Recorded as Not Evaluated: an honest, citable-by-absence result that also
      // stops this species from being re-checked on every backfill run.
      patch.iucn_global_status = 'NE';
      notes.push('sin evaluación en la Lista Roja de la IUCN');
    }
  }

  if (nextReferences !== references) patch.references = nextReferences;
  return { patch, notes };
}

/** Whether a species still has something to fetch from GBIF or the Red List. */
export function needsSourceEnrichment(record) {
  if (!record?.scientific_name?.trim()) return false;
  const references = Array.isArray(record?.references) ? record.references : [];
  return !hasGbifReference(references) || !record?.iucn_global_status;
}
