import React from 'react';
import { motion } from 'framer-motion';
import { AudioWaveform, Eye, Users, Target } from 'lucide-react';

export default function About() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary py-20 sm:py-28">
        <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-secondary to-primary" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <AudioWaveform className="w-10 h-10 text-secondary mx-auto mb-6" />
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-white leading-tight">
              Quiénes Somos
            </h1>
            <p className="mt-6 text-lg text-white/80 leading-relaxed max-w-2xl mx-auto">
              La Corporación Museo Bioacústico es una organización sin fines de lucro conformada por un
              equipo interdisciplinario de profesionales unid@s por el amor a la naturaleza. Buscamos
              conectar a la gente con la vida silvestre a través de la puesta en valor del patrimonio
              natural sonoro.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission + Vision */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            className="bg-card rounded-2xl border border-border p-8"
          >
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-5">
              <Target className="w-5 h-5 text-secondary" />
            </div>
            <h2 className="text-2xl font-display font-bold text-primary mb-4">Misión</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ser la organización pionera en la conservación de los ecosistemas de Chile poniendo en valor
              su Patrimonio Acústico Natural desde una perspectiva multidisciplinaria mediante la investigación
              y divulgación científica, educación y ciencia participativa, garantizando el acceso al conocimiento
              para toda la sociedad, a través de la creación de productos y servicios en distintos medios y formatos.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            className="bg-card rounded-2xl border border-border p-8"
          >
            <div className="w-12 h-12 rounded-xl bg-ocher/10 flex items-center justify-center mb-5">
              <Eye className="w-5 h-5 text-ocher" />
            </div>
            <h2 className="text-2xl font-display font-bold text-primary mb-4">Visión</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ser la organización de referencia para la comprensión y valoración de la biodiversidad a
              través de sus sonidos, facilitando a las comunidades la toma de decisiones de conservación
              para crear relaciones sustentables entre la sociedad y la biosfera.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Location */}
      <section className="bg-muted border-y border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Users className="w-5 h-5 text-secondary" />
            <span className="text-xs font-heading uppercase tracking-[0.25em] text-secondary font-medium">
              Desde Chile
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-primary">
            Concepción, Biobío
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Operamos desde el corazón del sur de Chile, una de las regiones con mayor biodiversidad
            acústica del país. Nuestra ubicación nos permite documentar la rica fauna de bosques templados,
            humedales y costas del Pacífico.
          </p>
        </div>
      </section>

      {/* Images */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-gradient-to-br from-[#062a2e] to-[#0a3d35] flex items-center justify-center">
            <span className="text-white/30 text-sm font-heading uppercase tracking-widest">Fotografía próximamente</span>
          </div>
          <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-gradient-to-br from-[#0a3d35] to-[#1a5c40] flex items-center justify-center">
            <span className="text-white/30 text-sm font-heading uppercase tracking-widest">Fotografía próximamente</span>
          </div>
        </div>
      </section>
    </div>
  );
}
