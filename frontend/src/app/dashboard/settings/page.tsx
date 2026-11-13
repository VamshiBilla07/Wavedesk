'use client';

import React from 'react';
import { Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Company profile, WhatsApp Cloud API credentials, and webhook endpoints
        </p>
      </div>

      <Card className="text-center py-16 border-dashed">
        <CardHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Settings className="w-6 h-6" />
          </div>
          <CardTitle>Settings Coming in Phase 2</CardTitle>
          <CardDescription>
            WhatsApp credential management with AES-256-GCM encryption, webhook URL copying, and team member management will be added in Phase 2.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
