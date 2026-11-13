'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function CustomersPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
        <p className="text-sm text-muted-foreground">
          Customer contact directory, tags, contact types, and CSV import/export
        </p>
      </div>

      <Card className="text-center py-16 border-dashed">
        <CardHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Users className="w-6 h-6" />
          </div>
          <CardTitle>Customer Directory Coming in Phase 2</CardTitle>
          <CardDescription>
            Full contact management with CSV import/export, deduplication, and tag/type filtering will be implemented in Phase 2.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
