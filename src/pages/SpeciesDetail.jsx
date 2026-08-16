import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, User, Info, Share2, Copy, Code, ChevronDown, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SpectrogramPlayer from '@/components/audio/SpectrogramPlayer';
import { spectrogramSettings } from '@/lib/spectrogram';
import ReactMarkdown from 'react-markdown';
import SpeciesLocationMap from '@/components/species/SpeciesLocationMap';

const taxonLabels = {
  aves: 'Aves',
  insectos: 'Insectos',
  anfibios: 'Anfibios',
  cetaceos: 'Cetáceos',
  mamiferos_terrestres: 'Roedores',
  felinos: 'Felinos',
};

const conservationLabels = {
  LC: 'Preocupación Menor', NT: 'Casi Amenazada', VU: 'Vulnerable',
  EN: 'En Peligro', CR: 'En Peligro Crítico', EW: 'Extinta en Estado Silvestre',
  EX: 'Extinta', DD: 'Datos Insuficientes', NE: 'No Evaluada',
};

// Render a citation's Markdown inline: unwrap the paragraph ReactMarkdown would
// otherwise emit, so the [n] marker, the citation and the DOI link stay on one flow.
const inlineMarkdownComponents = {
  p: ({ children }) => <>{children}</>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-secondary underline underline-offset-2 hover:text-primary break-words"
    >
      {children}
    </a>
  ),
};

// Pull the bare identifier out of a doi.org link (null for any other URL). The
// link itself reads "Ver artículo" for a general audience; the DOI is shown after
// it in small grey type, where it stays available to academic readers as the
// citation's permanent identifier without becoming the visible call to action.
const doiFromUrl = (url) => url.match(/^https?:\/\/(?:dx\.)?doi\.org\/(10\.\S+)$/i)?.[1] || null;

const conservationColors = {
  LC: 'bg-green-100 text-green-800', NT: 'bg-yellow-100 text-yellow-800',
  VU: 'bg-orange-100 text-orange-800', EN: 'bg-red-100 text-red-800',
  CR: 'bg-red-200 text-red-900', EW: 'bg-purple-100 text-purple-800',
  EX: 'bg-gray-200 text-gray-800', DD: 'bg-gray-100 text-gray-600',
  NE: 'bg-gray-100 text-gray-500',
};

export default function SpeciesDetail() {
  const { id } = useParams();
  const [showEmbedMenu, setShowEmbedMenu] = useState(false);

  const { data: species, isLoading } = useQuery({
    queryKey: ['species', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('species')
        .select('*')
        .eq('id', id)
        .single();
      return data || null;
    },
    enabled: !!id,
  });

  // Update page title and Open Graph meta tags
  useEffect(() => {
    if (species) {
      document.title = `${species.common_name} - Museo Bioacústico`;

      // Update or create Open Graph meta tags
      const updateMetaTag = (property, content) => {
        let tag = document.querySelector(`meta[property="${property}"]`);
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute('property', property);
          document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
      };

      const updateMetaName = (name, content) => {
        let tag = document.querySelector(`meta[name="${name}"]`);
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute('name', name);
          document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
      };

      updateMetaTag('og:title', species.common_name);
      updateMetaTag('og:description', species.sound_description || species.description || `${species.common_name} (${species.scientific_name})`);
      updateMetaTag('og:url', window.location.href);
      updateMetaTag('og:type', 'website');
      if (species.image_url) {
        updateMetaTag('og:image', species.image_url);
        updateMetaTag('og:image:alt', species.common_name);
      }
      updateMetaTag('og:site_name', 'Museo Bioacústico');

      updateMetaName('twitter:card', 'summary_large_image');
      updateMetaName('twitter:title', species.common_name);
      updateMetaName('twitter:description', species.sound_description || species.description || `${species.common_name} (${species.scientific_name})`);
      if (species.image_url) {
        updateMetaName('twitter:image', species.image_url);
      }
    }
  }, [species]);

  const handleShare = async () => {
    const url = window.location.href;
    const title = species.common_name;
    const text = `${species.common_name} - ${species.scientific_name}`;

    // Use Web Share API if available
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        console.log('Share cancelled or failed');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(url);
      alert('Enlace copiado al portapapeles');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Enlace copiado al portapapeles');
  };

  const handleEmbedSimple = () => {
    const embedCode = `<iframe src='${window.location.origin}/embed/${id}?simple=1' scrolling='no' frameborder='0' width='340' height='115'></iframe>`;
    navigator.clipboard.writeText(embedCode);
    alert('Código de embed copiado al portapapeles');
  };

  const handleEmbedSonogram = () => {
    const embedCode = `<iframe src='${window.location.origin}/embed/${id}' scrolling='no' frameborder='0' width='340' height='220'></iframe>`;
    navigator.clipboard.writeText(embedCode);
    alert('Código de embed copiado al portapapeles');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  if (!species) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-lg text-muted-foreground">Especie no encontrada</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/coleccion">Volver a la colección</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-6 text-muted-foreground">
        <Link to="/coleccion">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          {species.image_url && (
            <div>
              <div className="rounded-xl overflow-hidden aspect-[16/9] bg-muted">
                <img
                  src={species.image_url}
                  alt={species.common_name}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: `50% ${species.image_position_y ?? 50}%` }}
                />
              </div>
              {species.image_author && (
                <p className="text-xs text-muted-foreground mt-1.5 px-1">
                  {species.image_license && <span>{species.image_license} </span>}
                  {!species.image_license?.startsWith('©') && '© '}{species.image_author}
                  {species.image_source_platform && species.image_source_url && (
                    <> · <a href={species.image_source_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{species.image_source_platform}</a></>
                  )}
                  {species.image_source_platform && !species.image_source_url && (
                    <> · {species.image_source_platform}</>
                  )}
                </p>
              )}
            </div>
          )}

          {species.audio_url && (
            <SpectrogramPlayer
              audioUrl={species.audio_url}
              {...spectrogramSettings(species)}
              altText={`Espectrograma del sonido de ${species.common_name} (${species.scientific_name})`}
            />
          )}

          {species.sound_description && (
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-semibold text-primary flex items-center gap-2">
                  <Info className="w-4 h-4 text-secondary" />
                  Sobre este sonido
                </h3>
                {(species.frequency_min || species.frequency_max) && (
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {species.frequency_min && species.frequency_max
                      ? `${species.frequency_min}–${species.frequency_max} kHz`
                      : `${species.frequency_min || species.frequency_max} kHz`}
                  </span>
                )}
              </div>
              <ReactMarkdown className="text-muted-foreground leading-relaxed prose prose-sm max-w-none prose-p:my-1">
                {species.sound_description}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div>
            <Badge className="bg-secondary/10 text-secondary border-0 text-[10px] uppercase tracking-widest font-heading mb-2">
              {taxonLabels[species.taxon] || species.taxon}
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-primary leading-tight">
              {species.common_name}
            </h1>
            <p className="text-lg italic text-muted-foreground mt-1">{species.scientific_name}</p>
            
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="flex items-center gap-2"
                title="Compartir"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Compartir</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                title="Copiar enlace"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmbedMenu(!showEmbedMenu)}
                  className="flex items-center gap-2"
                  title="Copiar código embed"
                >
                  <Code className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs">Embed</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
                {showEmbedMenu && (
                  <div className="absolute right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 min-w-max">
                    <button
                      onClick={() => {
                        handleEmbedSimple();
                        setShowEmbedMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-muted transition-colors first:rounded-t-md"
                    >
                      Simple (340×115)
                    </button>
                    <button
                      onClick={() => {
                        handleEmbedSonogram();
                        setShowEmbedMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-muted transition-colors border-t border-border last:rounded-b-md"
                    >
                      Con espectrograma (340×220)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <h3 className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-semibold">
              Taxonomía
            </h3>
            {[
              { label: 'Orden', value: species.order },
              { label: 'Familia', value: species.family },
            ].filter(t => t.value).map(t => (
              <div key={t.label} className="flex justify-between items-center border-b border-border/50 pb-2 last:border-0 last:pb-0">
                <span className="text-xs font-mono text-muted-foreground uppercase">{t.label}</span>
                <span className="text-sm font-medium text-primary">{t.value}</span>
              </div>
            ))}
            {species.conservation_status && (
              <div className="pt-1">
                <Badge className={`${conservationColors[species.conservation_status] || 'bg-muted text-muted-foreground'} text-xs`}>
                  {species.conservation_status} — {conservationLabels[species.conservation_status] || ''}
                </Badge>
              </div>
            )}
          </div>

          {species.description && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-semibold mb-3">Descripción</h3>
              <ReactMarkdown className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none prose-p:my-1">
                {species.description}
              </ReactMarkdown>
            </div>
          )}

          {species.habitat && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-semibold mb-3">Hábitat y Distribución</h3>
              <ReactMarkdown className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none prose-p:my-1">{species.habitat}</ReactMarkdown>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border p-5 space-y-2.5">
            <h3 className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              Información de Grabación
            </h3>
            {species.recording_location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
                {species.recording_location}
              </div>
            )}
            {species.recording_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 text-secondary shrink-0" />
                {species.recording_date}
              </div>
            )}
            {species.recordist && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-3.5 h-3.5 text-secondary shrink-0" />
                {species.recordist}
              </div>
            )}
            <SpeciesLocationMap
              latitude={species.recording_latitude}
              longitude={species.recording_longitude}
              locationName={species.recording_location}
              speciesName={species.common_name}
            />
          </div>
        </div>
      </div>

      {Array.isArray(species.references) && species.references.length > 0 && (
        <div className="mt-8 bg-card rounded-xl border border-border p-6">
          <h3 className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-secondary" />
            Referencias
          </h3>
          <ol className="space-y-3">
            {species.references.map((ref, i) => {
              const doi = ref.url ? doiFromUrl(ref.url) : null;
              return (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                  <span className="font-mono text-xs text-secondary shrink-0 pt-0.5">[{i + 1}]</span>
                  <span className="min-w-0">
                    <ReactMarkdown components={inlineMarkdownComponents}>
                      {ref.citation}
                    </ReactMarkdown>
                    {ref.url && (
                      <>
                        {' '}
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-secondary underline underline-offset-2 hover:text-primary break-words"
                        >
                          {ref.url_label || 'Ver artículo'}
                        </a>
                      </>
                    )}
                    {doi && (
                      <span className="ml-1.5 font-mono text-xs text-muted-foreground/70 break-all">
                        doi:{doi}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
