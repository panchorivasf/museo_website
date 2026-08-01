import React from 'react';
import AdminArticleList from '@/components/admin/AdminArticleList';

export default function AdminBlog() {
  return (
    <AdminArticleList
      table="blog_posts"
      basePath="/blog"
      adminQueryKey="admin-blog-posts"
      publicQueryKey="blog-posts"
      title="Blog"
      entityLabel="Entrada"
      entityLabelNew="Nueva Entrada"
      entityLabelPluralLower="entrada(s)"
    />
  );
}
