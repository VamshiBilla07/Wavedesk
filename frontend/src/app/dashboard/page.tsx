'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  MessageSquare,
  Send,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AuthMeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    companyId: string;
  };
  company: {
    id: string;
    name: string;
  };
}

export default function DashboardOverviewPage() {
  const { data: authData, isLoading } = useQuery<AuthMeResponse>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<AuthMeResponse>('/auth/me'),
  });

  const cards = [
    {
      title: 'Total Customers',
      value: '0',
      description: 'Audience contacts saved',
      icon: Users,
      href: '/dashboard/customers',
    },
    {
      title: 'Messages Today',
      value: '0',
      description: 'Inbound & outbound messages',
      icon: MessageSquare,
      href: '/dashboard/inbox',
    },
    {
      title: 'Active Campaigns',
      value: '0',
      description: 'Campaigns running or queued',
      icon: Send,
      href: '/dashboard/campaigns',
    },
    {
      title: 'Delivery Rate',
      value: '100%',
      description: 'Messages successfully delivered',
      icon: CheckCircle2,
      href: '/dashboard/analytics',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
              Phase 1: Foundation Active
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {isLoading
              ? 'Loading workspace...'
              : `Welcome to ${authData?.company?.name || 'Wavedesk'}, ${authData?.user?.name || ''}`}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your WhatsApp Business CRM environment is configured and ready for contacts and messaging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/inbox">
            <Button className="shadow-sm">
              <MessageSquare className="w-4 h-4 mr-2" />
              Open Inbox
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Icon className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                <Link
                  href={card.href}
                  className="mt-3 text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                >
                  View details <ArrowUpRight className="w-3 h-3" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Getting Started Guide */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle>Getting Started with Wavedesk</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border bg-muted/30">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm mb-2">
                1
              </div>
              <h4 className="font-semibold text-sm mb-1">Connect WhatsApp</h4>
              <p className="text-xs text-muted-foreground">
                In Phase 2, connect your Phone Number ID and WABA token or test with WhatsApp Mock mode.
              </p>
            </div>

            <div className="p-4 rounded-xl border bg-muted/30">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm mb-2">
                2
              </div>
              <h4 className="font-semibold text-sm mb-1">Import Contacts</h4>
              <p className="text-xs text-muted-foreground">
                Upload CSV contacts, organize by contact types, and tag your customer segments.
              </p>
            </div>

            <div className="p-4 rounded-xl border bg-muted/30">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm mb-2">
                3
              </div>
              <h4 className="font-semibold text-sm mb-1">Launch Campaigns</h4>
              <p className="text-xs text-muted-foreground">
                Sync approved Meta templates and run throttled bulk WhatsApp campaigns.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
