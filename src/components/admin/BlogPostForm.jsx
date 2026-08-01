import React from 'react';
import ArticleForm from './ArticleForm';

export default function BlogPostForm({ post, onClose }) {
  return (
    <ArticleForm
      item={post}
      onClose={onClose}
      table="blog_posts"
      basePath="/blog"
      adminQueryKey="admin-blog-posts"
      publicQueryKey="blog-posts"
      entityLabel="Entrada"
      entityLabelNew="Nueva Entrada"
    />
  );
}
