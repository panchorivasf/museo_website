import React from 'react';
import ArticleDetailPage from '@/components/blog/ArticleDetailPage';

export default function BlogPost() {
  return (
    <ArticleDetailPage
      table="blog_posts"
      basePath="/blog"
      queryKeyPrefix="blog-post"
      notFoundMessage="Esta entrada no existe o no está publicada."
      backLabel="Volver al blog"
    />
  );
}
