'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function InboxPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Shared Inbox</h2>
          <p className="text-sm text-muted-foreground">
            Real-time WhatsApp customer conversations and 24-hour window tracking
          </p>
        </div>
      </div>

      <Card className="text-center py-16 border-dashed">
        <CardHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <MessageSquare className="w-6 h-6" />
          </div>
          <CardTitle>Inbox Coming in Phase 2</CardTitle>
          <CardDescription>
            Three-pane WhatsApp inbox (customer list, live chat thread, and contact attributes) with 24-hour window enforcement will be enabled in Phase 2.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
