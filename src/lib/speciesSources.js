import {
  buildGbifReference, hasGbifReference, isUsableGbifMatch, matchGbifName,
} from '@/lib/gbif';
import { buildIucnReference, fetchIucnAssessment, hasIucnReference } from '@/lib/iucn';

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

  const match = await matchGbifName(name);
  if (!isUsableGbifMatch(match)) {
    throw new Error(
      match?.matchType === 'HIGHERRANK'
        ? `GBIF solo reconoce «${match.canonicalName || ''}», no la especie`
        : 'sin coincidencia en GBIF',
    );
  }

  const patch = {};
  let nextReferences = references;

  if (needsGbifReference) {
    nextReferences = [...nextReferences, buildGbifReference(match, { now })];
  }

  if (needsIucn) {
    const assessment = await fetchIucnAssessment(match.usageKey);
    if (assessment) {
      patch.iucn_global_status = assessment.code;
      if (!hasIucnReference(nextReferences)) {
        nextReferences = [
          ...nextReferences,
          buildIucnReference(assessment, { now, searchName: match.canonicalName }),
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
