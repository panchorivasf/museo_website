import React from 'react';
import AdminArticleList from '@/components/admin/AdminArticleList';

export default function AdminConcepts() {
  return (
    <AdminArticleList
      table="concepts"
      basePath="/conceptos"
      adminQueryKey="admin-concepts"
      publicQueryKey="concepts"
      title="Conceptos"
      entityLabel="Concepto"
      entityLabelNew="Nuevo Concepto"
      entityLabelPluralLower="concepto(s)"
    />
  );
}
