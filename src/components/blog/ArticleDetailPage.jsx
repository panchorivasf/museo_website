import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import BlogPostView from '@/components/blog/BlogPostView';

/**
 * Generic published-article detail page, reused by /blog/:slug and /conceptos/:slug.
 */
export default function ArticleDetailPage({ table, basePath, queryKeyPrefix, notFoundMessage, backLabel }) {
  const { slug } = useParams();

  const { data: post, isLoading } = useQuery({
    queryKey: [queryKeyPrefix, slug],
    queryFn: async () => {
      const { data } = await supabase
        .from(table)
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
        <p className="text-muted-foreground mb-4">{notFoundMessage}</p>
        <Button asChild variant="outline">
          <Link to={basePath}><ArrowLeft className="w-4 h-4 mr-1.5" /> {backLabel}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground">
        <Link to={basePath}><ArrowLeft className="w-4 h-4 mr-1.5" /> {backLabel}</Link>
      </Button>
      <BlogPostView post={post} />
    </div>
  );
}
