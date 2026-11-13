'use client';

import React from 'react';
import { FolderTree } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ContactTypesPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Contact Types</h2>
        <p className="text-sm text-muted-foreground">
          Categorize your customer relationships (e.g., Lead, VIP, Partner, Customer)
        </p>
      </div>

      <Card className="text-center py-16 border-dashed">
        <CardHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <FolderTree className="w-6 h-6" />
          </div>
          <CardTitle>Contact Types Coming in Phase 2</CardTitle>
          <CardDescription>
            Custom contact categories with color badges and segmentation rules will be available in Phase 2.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
