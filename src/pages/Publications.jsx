import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ExternalLink, FileDown, ArrowUpDown } from 'lucide-react';
import { hasRichText, richTextToPlain, stripPastedColors } from '@/lib/richText';

// 'default' is whatever order the admin set (custom drag order, or by year when
// no row carries a sort_order); the rest let a visitor override it for their own
// view only, without touching what anyone else sees.
const SORT_OPTIONS = [
  { value: 'default', label: 'Orden del museo' },
  { value: 'year_desc', label: 'Año: más reciente' },
  { value: 'year_asc', label: 'Año: más antiguo' },
  { value: 'title_asc', label: 'Título: A-Z' },
];

function sortItems(items, mode) {
  // The query already returns the museum's order, so there is nothing to do.
  if (mode === 'default') return items;

  const copy = [...items];
  if (mode === 'title_asc') {
    return copy.sort((a, b) => richTextToPlain(a.title)
      .localeCompare(richTextToPlain(b.title), 'es', { sensitivity: 'base' }));
  }

  // Undated papers go last in both directions rather than leading the ascending
  // list, where a missing year would read as "oldest".
  const dir = mode === 'year_asc' ? 1 : -1;
  return copy.sort((a, b) => {
    if (a.year == null || b.year == null) {
      if (a.year == null && b.year == null) return 0;
      return a.year == null ? 1 : -1;
    }
    return (a.year - b.year) * dir;
  });
}

/**
 * Publication cards. Unlike Blog/Conceptos these are flat records shown in full
 * on the list itself, so there is no detail route to link into.
 */
function PublicationCard({ item }) {
  const meta = [item.venue, item.year].filter(Boolean).join(', ');

  return (
    <article className="rounded-xl overflow-hidden bg-card border border-border shadow-sm">
      <div className="p-5 sm:p-6">
        <h2
          className="font-heading font-semibold text-lg text-primary leading-tight [&_p]:m-0 [&_sub]:align-sub [&_sub]:text-[0.8em] [&_sup]:align-super [&_sup]:text-[0.8em]"
          dangerouslySetInnerHTML={{ __html: stripPastedColors(item.title) }}
        />

        {item.authors && (
          <p className="text-sm text-muted-foreground mt-1.5">{item.authors}</p>
        )}
        {meta && (
          <p className="text-xs font-mono text-muted-foreground/70 mt-1">{meta}</p>
        )}

        {item.figure_url && (
          <figure className="mt-5">
            {/* object-contain, not cover: these are scientific figures, so cropping
                them to fill a fixed box would cut off panels, axes or legends. */}
            <img
              src={item.figure_url}
              alt={richTextToPlain(item.figure_caption) || richTextToPlain(item.title)}
              className="w-full max-h-[26rem] object-contain rounded-lg bg-muted"
            />
            {hasRichText(item.figure_caption) && (
              <figcaption
                className="text-xs text-muted-foreground mt-2 [&_p]:m-0 [&_a]:text-secondary [&_a]:underline [&_sub]:align-sub [&_sub]:text-[0.8em] [&_sup]:align-super [&_sup]:text-[0.8em]"
                dangerouslySetInnerHTML={{ __html: stripPastedColors(item.figure_caption) }}
              />
            )}
          </figure>
        )}

        {hasRichText(item.abstract) && (
          <div
            className="text-sm text-foreground/80 mt-5 leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_a]:text-secondary [&_a]:underline [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_sub]:align-sub [&_sub]:text-[0.8em] [&_sup]:align-super [&_sup]:text-[0.8em]"
            dangerouslySetInnerHTML={{ __html: stripPastedColors(item.abstract) }}
          />
        )}

        {(item.article_url || item.pdf_url) && (
          <div className="flex flex-wrap gap-2 mt-5">
            {item.article_url && (
              <Button asChild size="sm" className="bg-secondary hover:bg-secondary/90 gap-1.5">
                <a href={item.article_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" /> Ver artículo
                </a>
              </Button>
            )}
            {item.pdf_url && (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <a href={item.pdf_url} target="_blank" rel="noopener noreferrer">
                  <FileDown className="w-3.5 h-3.5" /> Descargar PDF
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function Publications() {
  const [sort, setSort] = useState('default');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['publications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('publications')
        .select('id, title, authors, venue, year, abstract, figure_url, figure_caption, article_url, pdf_url, sort_order')
        .eq('published', true)
        // Rows the admin arranged by hand come first, in that order; the rest
        // (sort_order null) fall back to newest year first.
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('year', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const sorted = useMemo(() => sortItems(items, sort), [items, sort]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="font-display font-bold text-3xl text-primary mb-2">Publicaciones</h1>
          <p className="text-muted-foreground">
            Artículos científicos y otros trabajos publicados por el equipo del museo.
          </p>
        </div>

        {items.length > 1 && (
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-9 w-[200px] text-sm" aria-label="Ordenar publicaciones">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">Aún no hay publicaciones.</p>
      ) : (
        <div className="space-y-6">
          {sorted.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <PublicationCard item={item} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
