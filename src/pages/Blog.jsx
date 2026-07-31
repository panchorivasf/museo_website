import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { supabase } from '@/api/supabaseClient';

export default function Blog() {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, subtitle, slug, cover_image_url, created_at')
        .eq('published', true)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-display font-bold text-3xl text-primary mb-2">Blog</h1>
      <p className="text-muted-foreground mb-10">Historias, expediciones y hallazgos del Museo Bioacústico.</p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <p className="text-muted-foreground">Aún no hay entradas publicadas.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Link
                to={`/blog/${post.slug}`}
                className="block group rounded-xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-lg transition-shadow duration-300"
              >
                <div className="aspect-[16/9] overflow-hidden bg-muted">
                  {post.cover_image_url ? (
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <span className="text-4xl">📝</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-xs font-mono text-muted-foreground/70 mb-1">
                    {new Date(post.created_at).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <h2 className="font-heading font-semibold text-lg text-primary leading-tight">
                    {post.title}
                  </h2>
                  {post.subtitle && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.subtitle}</p>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
