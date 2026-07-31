import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import SpectrogramPlayer from '@/components/audio/SpectrogramPlayer';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])), { padding: [30, 30] });
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 10);
    }
  }, [points, map]);
  return null;
}

function BlockRenderer({ block }) {
  if (block.type === 'text') {
    return (
      <div
        className="text-foreground leading-relaxed [&_h2]:font-heading [&_h2]:text-primary [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:font-heading [&_h3]:text-primary [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_p]:mb-3 [&_a]:text-secondary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_strong]:font-semibold"
        dangerouslySetInnerHTML={{ __html: block.html }}
      />
    );
  }

  if (block.type === 'image') {
    return (
      <figure>
        <img src={block.url} alt={block.caption || ''} className="w-full rounded-xl border border-border" />
        {block.caption && (
          <figcaption className="text-xs text-muted-foreground text-center mt-2">{block.caption}</figcaption>
        )}
      </figure>
    );
  }

  if (block.type === 'audio') {
    return (
      <div>
        {block.title && <p className="text-sm font-heading font-medium text-primary mb-2">{block.title}</p>}
        <SpectrogramPlayer
          audioUrl={block.url}
          spectrogramMin={block.spectrogramMin}
          spectrogramMax={block.spectrogramMax}
          altText={block.title || 'Espectrograma'}
        />
      </div>
    );
  }

  if (block.type === 'map') {
    const points = block.points || [];
    if (points.length === 0) return null;
    const center = [points[0].lat, points[0].lng];
    return (
      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 400 }}>
        <MapContainer center={center} zoom={8} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          {points.map((p, i) => (
            <Marker key={i} position={[p.lat, p.lng]}>
              {p.label && <Popup>{p.label}</Popup>}
            </Marker>
          ))}
        </MapContainer>
      </div>
    );
  }

  return null;
}

export default function BlogPost() {
  const { slug } = useParams();

  const { data: post, isLoading } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single();
      return data || null;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <p className="text-muted-foreground mb-4">Esta entrada no existe o no está publicada.</p>
        <Button asChild variant="outline">
          <Link to="/blog"><ArrowLeft className="w-4 h-4 mr-1.5" /> Volver al blog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground">
        <Link to="/blog"><ArrowLeft className="w-4 h-4 mr-1.5" /> Volver al blog</Link>
      </Button>

      <p className="text-xs font-mono text-muted-foreground/70 mb-2">
        {new Date(post.created_at).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
      <h1 className="font-display font-bold text-3xl sm:text-4xl text-primary leading-tight">{post.title}</h1>
      {post.subtitle && <p className="text-lg text-muted-foreground mt-2">{post.subtitle}</p>}

      {post.cover_image_url && (
        <img src={post.cover_image_url} alt={post.title} className="w-full aspect-[16/9] object-cover rounded-xl border border-border mt-6" />
      )}

      <div className="space-y-6 mt-8">
        {(post.content || []).map((block, i) => (
          <BlockRenderer key={block.id || i} block={block} />
        ))}
      </div>
    </div>
  );
}
