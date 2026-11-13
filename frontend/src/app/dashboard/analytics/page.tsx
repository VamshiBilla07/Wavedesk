'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Message volume, delivery &amp; read rates, and audience engagement metrics
        </p>
      </div>

      <Card className="text-center py-16 border-dashed">
        <CardHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <BarChart3 className="w-6 h-6" />
          </div>
          <CardTitle>Analytics Coming in Phase 5</CardTitle>
          <CardDescription>
            Overview charts (7d/30d), message delivery funnels, and response time telemetry will be enabled in Phase 5.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
