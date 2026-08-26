/**
 * Helpers for the HTML produced by the Quill editors.
 *
 * Quill never yields an empty string: clearing a field leaves "<p><br></p>",
 * which is truthy and would otherwise be stored as content and rendered as a
 * stray blank paragraph. Everything here exists to treat that as empty.
 */

const TAG_RE = /<[^>]*>/g;
const NBSP_RE = /&nbsp;/g;

/** True when the HTML carries visible text (or an embedded image). */
export function hasRichText(html) {
  if (!html) return false;
  if (/<img\b/i.test(html)) return true;
  return html.replace(TAG_RE, '').replace(NBSP_RE, ' ').trim().length > 0;
}

/** Tags stripped, for places that need plain text (alt attributes, previews). */
export function richTextToPlain(html) {
  if (!html) return '';
  return html.replace(TAG_RE, '').replace(NBSP_RE, ' ').replace(/\s+/g, ' ').trim();
}

/** Normalizes Quill's empty-field markup to null, for storage. */
export function richTextToNull(html) {
  return hasRichText(html) ? html : null;
}
