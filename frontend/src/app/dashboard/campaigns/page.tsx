'use client';

import React from 'react';
import { Send } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function CampaignsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
        <p className="text-sm text-muted-foreground">
          Throttled bulk WhatsApp broadcast campaigns with real-time delivery funnels
        </p>
      </div>

      <Card className="text-center py-16 border-dashed">
        <CardHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Send className="w-6 h-6" />
          </div>
          <CardTitle>Campaigns Coming in Phase 4</CardTitle>
          <CardDescription>
            Audience targeting, throttled resumable background sending, live progress bars, pause/resume, and recipient tables arrive in Phase 4.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
