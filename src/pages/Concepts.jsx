import React from 'react';
import ArticleListPage from '@/components/blog/ArticleListPage';

export default function Concepts() {
  return (
    <ArticleListPage
      table="concepts"
      basePath="/conceptos"
      queryKey="concepts"
      title="Conceptos"
      description="Artículos breves sobre teoría, mecanismos y conceptos básicos de bioacústica."
      emptyMessage="Aún no hay conceptos publicados."
      fallbackIcon="📖"
    />
  );
}
