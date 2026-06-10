import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, AudioWaveform, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SpeciesCard from '@/components/species/SpeciesCard';
import chirihue from '@/assets/chirihue.png';

export default function Home() {
  const { data: featured = [] } = useQuery({
    queryKey: ['featured-species'],
    queryFn: async () => {
      const { data } = await supabase
        .from('species')
        .select('*')
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(6);
      return data || [];
    },
  });

  const { data: allSpecies = [] } = useQuery({
    queryKey: ['all-species-count'],
    queryFn: async () => {
      const { data } = await supabase
        .from('species')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const displaySpecies = featured.length > 0 ? featured : allSpecies.slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#062a2e] via-[#0a3d35] to-[#1a5c40]">
          {/* Subtle waveform lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10" preserveAspectRatio="none" viewBox="0 0 1440 600" xmlns="http://www.w3.org/2000/svg">
            {[0,1,2,3,4,5,6,7,8].map(i => (
              <path
                key={i}
                d={`M0,${300 + Math.sin(i) * 80} ${Array.from({length: 24}, (_, j) => {
                  const x = (j + 1) * 60;
                  const y = 300 + Math.sin((j + i) * 0.7) * (40 + i * 10);
                  return `L${x},${y}`;
                }).join(' ')} L1440,${300 + Math.sin(i + 24) * 80}`}
                fill="none"
                stroke="#5AAA95"
                strokeWidth="1.5"
              />
            ))}
          </svg>
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <div className="mb-8 relative overflow-visible">
              <div className="md:hidden mx-auto mb-6 w-full max-w-xs">
                <img src={chirihue} alt="Museo Bioacústico" className="mx-auto h-36 object-contain" />
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-white leading-[1.1] tracking-tight md:pr-56">
                Escucha el<br />
                <span className="text-secondary relative inline-flex">
                  Patrimonio Natural
                  <img
                    src={chirihue}
                    alt="Museo Bioacústico"
                    className="hidden md:block absolute -right-44 -top-32 h-64 w-auto object-contain"
                  />
                </span><br />
                de Chile
              </h1>
            </div>
            <p className="mt-6 text-lg text-white/80 leading-relaxed max-w-xl font-body">
              Descubre la riqueza acústica de la biodiversidad chilena. Explora espectrogramas,
              grabaciones de campo y mapas interactivos de nuestro archivo sonoro.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-full px-6 font-heading">
                <Link to="/coleccion">
                  <Headphones className="w-4 h-4 mr-2" />
                  Explorar Colección
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-6 font-heading border-white/30 text-white hover:bg-white/10 hover:text-white">
                <Link to="/mapa">
                  <MapPin className="w-4 h-4 mr-2" />
                  Ver Mapa
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Mission strip */}
      <section className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                icon: AudioWaveform,
                title: 'Patrimonio Acústico',
                text: 'Grabaciones de aves, insectos, anfibios y mamíferos de todo Chile.',
              },
              {
                icon: Headphones,
                title: 'Análisis Interactivo',
                text: 'Espectrogramas en tiempo real con control de velocidad para escuchar ultrasonidos.',
              },
              {
                icon: MapPin,
                title: 'Cartografía Sonora',
                text: 'Mapa interactivo con grabaciones geolocalizadas y filtros por taxón.',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-5 h-5 text-secondary" />
                </div>
                <h3 className="font-heading font-semibold text-primary text-lg">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured species */}
      {displaySpecies.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="text-xs font-heading uppercase tracking-[0.25em] text-secondary font-medium">
                Colección
              </span>
              <h2 className="text-3xl font-display font-bold text-primary mt-1">
                Especies Destacadas
              </h2>
            </div>
            <Button asChild variant="ghost" className="text-secondary font-heading group">
              <Link to="/coleccion">
                Ver todas <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displaySpecies.map(sp => (
              <SpeciesCard key={sp.id} species={sp} />
            ))}
          </div>
        </section>
      )}

      {/* Landscape CTA */}
      <section className="relative min-h-[50vh] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#062a2e] via-[#0a3d35] to-[#1a5c40]">
          <div className="absolute inset-0 bg-primary/40" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white leading-tight">
              La conservación comienza<br />por escuchar
            </h2>
            <p className="mt-4 text-white/80 text-lg leading-relaxed font-body">
              Somos un equipo interdisciplinario unidos por el amor a la conservación de espacios naturales,
              que busca visibilizar la vida silvestre a partir de su riqueza sonora.
            </p>
            <Button asChild size="lg" className="mt-8 bg-secondary hover:bg-secondary/90 rounded-full px-8 font-heading">
              <Link to="/nosotros">Conoce más sobre nosotros</Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
