import React from 'react';
import ArticleListPage from '@/components/blog/ArticleListPage';

export default function Blog() {
  return (
    <ArticleListPage
      table="blog_posts"
      basePath="/blog"
      queryKey="blog-posts"
      title="Blog"
      description="Historias, expediciones y hallazgos del Museo Bioacústico."
      emptyMessage="Aún no hay entradas publicadas."
    />
  );
}
