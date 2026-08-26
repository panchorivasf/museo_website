import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { X, Upload, Loader2, Trash2 } from 'lucide-react';
import { hasRichText, richTextToNull } from '@/lib/richText';

// The title toolbar is written out by hand (rather than declared as an array)
// because it carries two buttons Quill has no format for: the case converters.
const TITLE_TOOLBAR_ID = 'publication-title-toolbar';

// Quill keeps every format it knows about when text is pasted, whatever the
// toolbar offers -- which is how a paste from Word, Docs or a PDF arrives
// wearing a white background-color on every span. Whitelisting the formats each
// editor actually uses makes Quill drop the rest on the way in, so a normal
// paste keeps its italics and loses the highlight.
const titleFormats = ['italic', 'script'];
const abstractFormats = ['bold', 'italic', 'underline', 'script', 'list', 'link'];
const captionFormats = ['bold', 'italic', 'script', 'link'];

// --- Case conversion for the title -------------------------------------------
// Journals hand out titles in ALL CAPS; these turn one into something readable
// without retyping it (and so without losing the italics on the species names).

// Kept lowercase by the title-case pass unless they open or close the title.
const MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor',
  'of', 'on', 'or', 'over', 'per', 'the', 'to', 'versus', 'via', 'vs', 'with',
  'al', 'con', 'de', 'del', 'e', 'el', 'en', 'entre', 'la', 'las', 'los', 'o',
  'para', 'por', 'que', 'se', 'sin', 'sobre', 'su', 'un', 'una', 'y',
]);

const LETTER_RE = /\p{L}/u;
const SENTENCE_END_RE = /[.!?¡¿]/;
const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const CLAUSE_END_RE = /[.!?:;¡¿]/;
const SKIPPABLE_RE = /[\s"'‘’“”([{—–-]/;

// Recases character by character so the result is always the same length as the
// input, which is what lets the rewrite below keep every italic run aligned.
// (A handful of characters -- ss-ligature, dotted I -- grow when recased; those
// are left as they were rather than shifting everything after them.)
function mapCase(text, shouldUpper) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const recased = shouldUpper(i) ? ch.toUpperCase() : ch.toLowerCase();
    out += recased.length === 1 ? recased : ch;
  }
  return out;
}

/** "ACOUSTIC MONITORING. PART TWO" -> "Acoustic monitoring. Part two" */
function toSentenceCase(text) {
  const upper = new Set();
  let atSentenceStart = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (atSentenceStart && LETTER_RE.test(ch)) {
      upper.add(i);
      atSentenceStart = false;
    } else if (SENTENCE_END_RE.test(ch)) {
      atSentenceStart = true;
    }
  }
  return mapCase(text, i => upper.has(i));
}

// True when the word starting at `index` is the first one after punctuation
// that ends a clause, skipping any brackets or quotes in between.
function opensClause(text, index) {
  for (let i = index - 1; i >= 0; i--) {
    const ch = text[i];
    if (CLAUSE_END_RE.test(ch)) return true;
    if (!SKIPPABLE_RE.test(ch)) return false;
  }
  return false;
}

/** "ACOUSTIC MONITORING OF BIRDS" -> "Acoustic Monitoring of Birds" */
function toTitleCase(text) {
  const words = [];
  WORD_RE.lastIndex = 0;
  let match;
  while ((match = WORD_RE.exec(text)) !== null) {
    words.push({ index: match.index, word: match[0] });
  }

  const upper = new Set();
  words.forEach(({ index, word }, i) => {
    const isEdge = i === 0 || i === words.length - 1;
    // A minor word still takes a capital when it opens a subtitle or a new
    // sentence -- "Part Two: The Method", not "Part Two: the Method".
    if (isEdge || opensClause(text, index) || !MINOR_WORDS.has(word.toLowerCase())) {
      upper.add(index);
    }
  });
  return mapCase(text, i => upper.has(i));
}

/**
 * Applies `transform` to the selection, or to the whole field when nothing is
 * selected. The text is rewritten one Quill op at a time instead of being
 * replaced wholesale, because deleting the run and re-inserting plain text
 * would strip the italics the case change is supposed to preserve.
 */
function recase(editor, transform) {
  const selection = editor.getSelection();
  const range = selection && selection.length > 0
    ? selection
    // getLength() counts the trailing newline that ends the block; recasing it
    // is meaningless and rewriting it upsets the block, so it stays out.
    : { index: 0, length: Math.max(editor.getLength() - 1, 0) };
  if (range.length === 0) return;

  const contents = editor.getContents(range.index, range.length);
  // Embeds have no text to recase and would break the offset arithmetic. The
  // title editor cannot contain any, but bail out rather than corrupt the field.
  if (contents.ops.some(op => typeof op.insert !== 'string')) return;

  const text = contents.ops.map(op => op.insert).join('');
  const next = transform(text);
  if (next === text) return;

  const Delta = Quill.import('delta');
  const change = new Delta().retain(range.index);
  let offset = 0;
  contents.ops.forEach(op => {
    const length = op.insert.length;
    change.delete(length).insert(next.slice(offset, offset + length), op.attributes);
    offset += length;
  });

  editor.updateContents(change, 'user');
  editor.setSelection(range.index, range.length, 'silent');
}

// Superscript/subscript are here for the notation abstracts actually use
// (kHz ranges, m2, CO2, exponents); italics carry the scientific names.
const abstractModules = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ script: 'super' }, { script: 'sub' }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

// A caption is a single short line, so it gets inline marks only -- no lists.
const captionModules = {
  toolbar: [
    ['bold', 'italic'],
    [{ script: 'super' }, { script: 'sub' }],
    ['link'],
    ['clean'],
  ],
};

async function uploadFile(file) {
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(fileName, file, { cacheControl: '3600' });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
  return { url: publicUrl, originalName: file.name };
}

const EMPTY = {
  title: '',
  authors: '',
  venue: '',
  year: '',
  abstract: '',
  figure_url: '',
  figure_caption: '',
  article_url: '',
  pdf_url: '',
  published: false,
};

export default function PublicationForm({ item, onClose }) {
  const isEditing = !!item;
  const queryClient = useQueryClient();

  const [form, setForm] = useState(() => {
    if (!item) return EMPTY;
    return Object.fromEntries(
      Object.keys(EMPTY).map(k => [k, item[k] ?? EMPTY[k]])
    );
  });
  const titleRef = useRef(null);
  const [uploadingFigure, setUploadingFigure] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfName, setPdfName] = useState('');

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const applyCase = useCallback((transform) => {
    const editor = titleRef.current?.getEditor();
    if (editor) recase(editor, transform);
  }, []);

  // Memoized because ReactQuill rebuilds the editor whenever `modules` changes
  // identity, which would tear down the toolbar on every keystroke.
  const titleModules = useMemo(() => ({
    toolbar: {
      container: `#${TITLE_TOOLBAR_ID}`,
      handlers: {
        sentenceCase: () => applyCase(toSentenceCase),
        titleCase: () => applyCase(toTitleCase),
      },
    },
    // The card renders the title as a single-line heading, so Enter does nothing.
    keyboard: { bindings: { enter: { key: 13, handler: () => false } } },
  }), [applyCase]);

  const handleFigureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFigure(true);
    try {
      const { url } = await uploadFile(file);
      update('figure_url', url);
    } catch (err) {
      alert('Error al subir la figura: ' + err.message);
    } finally {
      setUploadingFigure(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const { url, originalName } = await uploadFile(file);
      update('pdf_url', url);
      setPdfName(originalName);
    } catch (err) {
      alert('Error al subir el PDF: ' + err.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        // Empty text inputs are stored as null rather than '' so the public page's
        // truthiness checks (which decide whether to render each block) hold.
        authors: form.authors || null,
        venue: form.venue || null,
        abstract: richTextToNull(form.abstract),
        figure_url: form.figure_url || null,
        figure_caption: richTextToNull(form.figure_caption),
        article_url: form.article_url || null,
        pdf_url: form.pdf_url || null,
        year: form.year === '' || form.year == null ? null : parseInt(form.year, 10),
      };
      if (isEditing) {
        const { error } = await supabase.from('publications').update(payload).eq('id', item.id);
        if (error) throw error;
      } else {
        // With a manual order in effect a new row would sort last (sort_order
        // null goes to the bottom), so it takes the top slot instead -- where a
        // freshly published paper belongs.
        const { data: top } = await supabase
          .from('publications')
          .select('sort_order')
          .not('sort_order', 'is', null)
          .order('sort_order', { ascending: true })
          .limit(1);
        if (top?.length) payload.sort_order = top[0].sort_order - 1;

        const { error } = await supabase.from('publications').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-publications'] });
      queryClient.invalidateQueries({ queryKey: ['publications'] });
      onClose();
    },
    onError: (err) => {
      alert('Error al guardar: ' + (err?.message || 'Por favor intenta de nuevo'));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // The title is a Quill field now, so `required` on an <input> can't guard it.
    if (!hasRichText(form.title)) {
      alert('El título es obligatorio.');
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-heading font-semibold text-primary text-lg">
          {isEditing ? 'Editar Publicación' : 'Nueva Publicación'}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label>Título *</Label>
          <div className="bg-background">
            {/* Hand-written toolbar: Quill binds each button to the handler
                named by its ql-* class. type="button" on every one of them,
                or clicking a format would submit the form. */}
            <div id={TITLE_TOOLBAR_ID}>
              <span className="ql-formats">
                <button type="button" className="ql-italic" aria-label="Cursiva" />
                <button type="button" className="ql-script" value="super" aria-label="Superíndice" />
                <button type="button" className="ql-script" value="sub" aria-label="Subíndice" />
                <button type="button" className="ql-clean" aria-label="Quitar formato" />
              </span>
              <span className="ql-formats">
                <button
                  type="button"
                  className="ql-sentenceCase !w-auto !px-2 text-xs font-medium"
                  title="Formato oración: solo la primera letra en mayúscula"
                >
                  Oración
                </button>
                <button
                  type="button"
                  className="ql-titleCase !w-auto !px-2 text-xs font-medium"
                  title="Mayúsculas Iniciales: una mayúscula por palabra"
                >
                  Título
                </button>
              </span>
            </div>
            <ReactQuill
              ref={titleRef}
              theme="snow"
              modules={titleModules}
              formats={titleFormats}
              value={form.title}
              onChange={html => update('title', html)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Los botones de formato convierten el texto seleccionado, o el título completo si no hay selección.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Autores</Label>
          <Input
            value={form.authors}
            onChange={e => update('authors', e.target.value)}
            placeholder="ej: Rivas F., Pérez M., González A."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Revista / Editorial</Label>
            <Input
              value={form.venue}
              onChange={e => update('venue', e.target.value)}
              placeholder="ej: Bioacoustics"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Año</Label>
            <Input
              type="number"
              value={form.year}
              onChange={e => update('year', e.target.value)}
              placeholder="2026"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Resumen (abstract)</Label>
          <div className="bg-background">
            <ReactQuill
              theme="snow"
              modules={abstractModules}
              formats={abstractFormats}
              value={form.abstract}
              onChange={html => update('abstract', html)}
            />
          </div>
        </div>

        {/* Figure */}
        <div className="space-y-1.5">
          <Label>Figura</Label>
          {form.figure_url ? (
            <div className="flex items-start gap-3">
              <img src={form.figure_url} alt="" className="w-40 rounded-lg border border-border object-cover" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => update('figure_url', '')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 w-fit">
              {uploadingFigure ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingFigure ? 'Subiendo...' : 'Subir figura'}
              <input type="file" accept="image/*" className="hidden" onChange={handleFigureUpload} disabled={uploadingFigure} />
            </label>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Leyenda de la figura</Label>
          <div className="bg-background">
            <ReactQuill
              theme="snow"
              modules={captionModules}
              formats={captionFormats}
              value={form.figure_caption}
              onChange={html => update('figure_caption', html)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Link al artículo</Label>
          <Input
            type="url"
            value={form.article_url}
            onChange={e => update('article_url', e.target.value)}
            placeholder="https://doi.org/..."
          />
        </div>

        {/* PDF */}
        <div className="space-y-1.5">
          <Label>PDF</Label>
          {form.pdf_url ? (
            <div className="flex items-center gap-3">
              <a
                href={form.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-secondary underline break-all"
              >
                {pdfName || form.pdf_url}
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive shrink-0"
                onClick={() => { update('pdf_url', ''); setPdfName(''); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 w-fit">
              {uploadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingPdf ? 'Subiendo...' : 'Subir PDF'}
              <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} disabled={uploadingPdf} />
            </label>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={form.published} onCheckedChange={v => update('published', v)} />
          <Label className="cursor-pointer">Publicado</Label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="bg-secondary hover:bg-secondary/90" disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
