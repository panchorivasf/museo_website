import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { ExternalLink, FileDown, FileText } from 'lucide-react';

/**
 * Publication cards. Unlike Blog/Conceptos these are flat records shown in full
 * on the list itself, so there is no detail route to link into.
 */
function PublicationCard({ item }) {
  const meta = [item.venue, item.year].filter(Boolean).join(', ');

  return (
    <article className="rounded-xl overflow-hidden bg-card border border-border shadow-sm">
      <div className="sm:flex">
        <div className="sm:w-64 sm:shrink-0 bg-muted">
          {item.figure_url ? (
            <img
              src={item.figure_url}
              alt={item.figure_caption || item.title}
              className="w-full h-48 sm:h-full object-cover"
            />
          ) : (
            <div className="w-full h-48 sm:h-full min-h-[12rem] flex items-center justify-center text-muted-foreground">
              <FileText className="w-10 h-10" />
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6 flex-1 min-w-0">
          <h2 className="font-heading font-semibold text-lg text-primary leading-tight">
            {item.title}
          </h2>

          {item.authors && (
            <p className="text-sm text-muted-foreground mt-1.5">{item.authors}</p>
          )}
          {meta && (
            <p className="text-xs font-mono text-muted-foreground/70 mt-1">{meta}</p>
          )}

          {item.abstract && (
            <p className="text-sm text-foreground/80 mt-3 whitespace-pre-line">
              {item.abstract}
            </p>
          )}

          {item.figure_caption && item.figure_url && (
            <p className="text-xs text-muted-foreground mt-3 italic">{item.figure_caption}</p>
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
      </div>
    </article>
  );
}

export default function Publications() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['publications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('publications')
        .select('id, title, authors, venue, year, abstract, figure_url, figure_caption, article_url, pdf_url')
        .eq('published', true)
        .order('year', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-display font-bold text-3xl text-primary mb-2">Publicaciones</h1>
      <p className="text-muted-foreground mb-10">
        Artículos científicos y otros trabajos publicados por el equipo del museo.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">Aún no hay publicaciones.</p>
      ) : (
        <div className="space-y-6">
          {items.map((item, i) => (
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
