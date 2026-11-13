'use client';

import React from 'react';
import { FileCode2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function TemplatesPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Message Templates</h2>
        <p className="text-sm text-muted-foreground">
          Create, sync, and preview Meta-approved WhatsApp message templates
        </p>
      </div>

      <Card className="text-center py-16 border-dashed">
        <CardHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <FileCode2 className="w-6 h-6" />
          </div>
          <CardTitle>Templates Coming in Phase 4</CardTitle>
          <CardDescription>
            Template creation wizard with live preview, variable mapping, and Meta Cloud API synchronization will arrive in Phase 4.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
