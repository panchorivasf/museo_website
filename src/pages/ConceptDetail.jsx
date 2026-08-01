import React from 'react';
import ArticleDetailPage from '@/components/blog/ArticleDetailPage';

export default function ConceptDetail() {
  return (
    <ArticleDetailPage
      table="concepts"
      basePath="/conceptos"
      queryKeyPrefix="concept"
      notFoundMessage="Este concepto no existe o no está publicado."
      backLabel="Volver a Conceptos"
    />
  );
}
