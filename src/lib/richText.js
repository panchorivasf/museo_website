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

const STYLE_ATTR_RE = /\sstyle="([^"]*)"/gi;
const COLOR_DECL_RE = /(?:^|;)\s*(?:background(?:-color)?|color)\s*:[^;]*/gi;

/**
 * Drops inline color/background declarations.
 *
 * The editors whitelist their formats, so a paste no longer brings the white
 * highlight Word and Google Docs put on every span -- but rows saved before
 * that do still carry it, and they would otherwise render as white-on-white
 * blocks. Stripping on the way out heals them without a migration.
 */
export function stripPastedColors(html) {
  if (!html) return html;
  return html.replace(STYLE_ATTR_RE, (_match, styles) => {
    const kept = styles.replace(COLOR_DECL_RE, '').replace(/^;+|;+$/g, '').trim();
    return kept ? ` style="${kept}"` : '';
  });
}

/** Normalizes Quill's empty-field markup to null, for storage. */
export function richTextToNull(html) {
  return hasRichText(html) ? html : null;
}
