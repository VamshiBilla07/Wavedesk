'use client';

import React from 'react';
import { Tag } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function TagsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tags</h2>
        <p className="text-sm text-muted-foreground">
          Manage customer labels for targeting campaigns and inbox filtering
        </p>
      </div>

      <Card className="text-center py-16 border-dashed">
        <CardHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Tag className="w-6 h-6" />
          </div>
          <CardTitle>Tag Management Coming in Phase 2</CardTitle>
          <CardDescription>
            Custom tags with colors and bulk assignment to customers will be available in Phase 2.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
