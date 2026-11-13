'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  MessageSquare,
  CheckCheck,
  CheckCircle2,
  Clock,
  Send,
  Zap,
  TrendingUp,
  AlertTriangle,
  Server,
  Activity,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AnalyticsSummary {
  audience: {
    total: number;
    optedOut: number;
    active24hWindows: number;
  };
  messages: {
    inboundTotal: number;
    outboundTotal: number;
    total: number;
    deliveryRate: number;
    readRate: number;
    failureRate: number;
    counts: {
      sent: number;
      delivered: number;
      read: number;
      failed: number;
    };
  };
  campaigns: {
    totalCampaigns: number;
    totalRecipients: number;
  };
  system: {
    cache: {
      hits: number;
      misses: number;
      hitRate: number;
    };
  };
}

interface TimeseriesItem {
  date: string;
  inbound: number;
  outbound: number;
  total: number;
}

export default function AnalyticsPage() {
  // 1. Fetch Analytics Summary
  const { data: summary, isLoading: isLoadingSummary } = useQuery<AnalyticsSummary>({
    queryKey: ['analytics', 'summary'],
    queryFn: () => api.get('/analytics/summary'),
    refetchInterval: 15000,
  });

  // 2. Fetch Timeseries Volume
  const { data: timeseriesData, isLoading: isLoadingTimeseries } = useQuery<{ timeseries: TimeseriesItem[] }>({
    queryKey: ['analytics', 'timeseries'],
    queryFn: () => api.get('/analytics/timeseries'),
    refetchInterval: 30000,
  });

  const maxDailyVolume = Math.max(
    ...(timeseriesData?.timeseries?.map((d) => d.total) || [1]),
    1
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics &amp; Telemetry</h2>
          <p className="text-sm text-muted-foreground">
            Audience engagement, WhatsApp delivery funnels, message volume, and Redis telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 py-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Metrics
          </Badge>
        </div>
      </div>

      {/* Top 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Audience */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Audience</CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingSummary ? '...' : summary?.audience.total || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {summary?.audience.optedOut || 0} opted-out contacts
            </p>
          </CardContent>
        </Card>

        {/* 24h Active Windows */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">24h Active Windows</CardTitle>
            <Clock className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {isLoadingSummary ? '...' : summary?.audience.active24hWindows || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Free-form messaging open</p>
          </CardContent>
        </Card>

        {/* Total Messages Exchanged */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Messages Exchanged</CardTitle>
            <MessageSquare className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingSummary ? '...' : summary?.messages.total || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {summary?.messages.outboundTotal || 0} out • {summary?.messages.inboundTotal || 0} in
            </p>
          </CardContent>
        </Card>

        {/* Delivery Success Rate */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Delivery Rate</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {isLoadingSummary ? '...' : `${summary?.messages.deliveryRate || 0}%`}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Delivered + Read vs Sent
            </p>
          </CardContent>
        </Card>

        {/* Message Read Rate */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Read Rate</CardTitle>
            <CheckCheck className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {isLoadingSummary ? '...' : `${summary?.messages.readRate || 0}%`}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Confirmed blue ticks</p>
          </CardContent>
        </Card>
      </div>

      {/* Middle Section: 14-Day Timeseries & Funnel Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 14-Day Message Volume Bar Chart (2 columns) */}
        <Card className="lg:col-span-2 shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">14-Day Message Traffic</CardTitle>
              <p className="text-xs text-muted-foreground">Daily inbound and outbound WhatsApp volume</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                Outbound
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-500" />
                Inbound
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingTimeseries ? (
              <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
                Loading volume timeseries...
              </div>
            ) : timeseriesData?.timeseries?.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
                No messaging traffic recorded in the past 14 days.
              </div>
            ) : (
              <div className="h-56 flex items-end gap-2 pt-6 pb-2">
                {timeseriesData?.timeseries?.map((day) => {
                  const outHeight = Math.round((day.outbound / maxDailyVolume) * 160);
                  const inHeight = Math.round((day.inbound / maxDailyVolume) * 160);
                  const label = day.date.slice(5); // "MM-DD"

                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative"
                    >
                      {/* Tooltip */}
                      <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] p-1.5 rounded-md shadow-md border pointer-events-none whitespace-nowrap z-10">
                        <div className="font-bold">{day.date}</div>
                        <div>Out: {day.outbound} • In: {day.inbound}</div>
                      </div>

                      {/* Stacked Bar */}
                      <div className="w-full max-w-[24px] flex flex-col justify-end rounded-xs overflow-hidden bg-muted/40 h-[170px]">
                        <div
                          style={{ height: `${inHeight}px` }}
                          className="w-full bg-blue-500 transition-all duration-300"
                        />
                        <div
                          style={{ height: `${outHeight}px` }}
                          className="w-full bg-emerald-500 transition-all duration-300"
                        />
                      </div>

                      {/* Date Label */}
                      <span className="text-[9px] text-muted-foreground mt-2 truncate max-w-full">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Funnel Conversion Breakdown Card */}
        <Card className="shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Delivery Funnel</CardTitle>
            <p className="text-xs text-muted-foreground">Outbound dispatch lifecycle</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sent */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Dispatched</span>
                <span className="font-bold">{summary?.messages.outboundTotal || 0}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-slate-400 w-full" />
              </div>
            </div>

            {/* Delivered */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Delivered</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {(summary?.messages.counts.delivered || 0) + (summary?.messages.counts.read || 0)}
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({summary?.messages.deliveryRate || 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  style={{ width: `${summary?.messages.deliveryRate || 0}%` }}
                  className="h-full bg-emerald-500 transition-all duration-300"
                />
              </div>
            </div>

            {/* Read */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Read (Blue Ticks)</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {summary?.messages.counts.read || 0}
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({summary?.messages.readRate || 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  style={{ width: `${summary?.messages.readRate || 0}%` }}
                  className="h-full bg-blue-500 transition-all duration-300"
                />
              </div>
            </div>

            {/* Failed */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Failed</span>
                <span className="font-bold text-red-500">
                  {summary?.messages.counts.failed || 0}
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({summary?.messages.failureRate || 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  style={{ width: `${summary?.messages.failureRate || 0}%` }}
                  className="h-full bg-red-500 transition-all duration-300"
                />
              </div>
            </div>
          </CardContent>
          <div className="p-4 border-t bg-muted/10 rounded-b-xl text-[11px] text-muted-foreground flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span>Updated via WebSocket and 60s cache tier</span>
          </div>
        </Card>
      </div>

      {/* Bottom Telemetry: Campaigns & Redis Cache Tier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Campaign Broadcast Highlights */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold">Broadcast Campaigns</CardTitle>
              <p className="text-xs text-muted-foreground">Bulk outreach volume and reach</p>
            </div>
            <Send className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-muted/30 border">
              <span className="text-[11px] text-muted-foreground">Total Campaigns</span>
              <div className="text-xl font-bold text-foreground mt-0.5">
                {summary?.campaigns.totalCampaigns || 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border">
              <span className="text-[11px] text-muted-foreground">Total Contacts Targeted</span>
              <div className="text-xl font-bold text-foreground mt-0.5">
                {summary?.campaigns.totalRecipients || 0}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Redis Cache Health & Performance */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold">Redis Cache Tier</CardTitle>
              <p className="text-xs text-muted-foreground">Cache hit efficiency and read acceleration</p>
            </div>
            <Server className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-muted/30 border">
              <span className="text-[10px] text-muted-foreground">Hit Rate</span>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {summary?.system.cache.hitRate || 0}%
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border">
              <span className="text-[10px] text-muted-foreground">Hits</span>
              <div className="text-xl font-bold text-foreground mt-0.5">
                {summary?.system.cache.hits || 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border">
              <span className="text-[10px] text-muted-foreground">Misses</span>
              <div className="text-xl font-bold text-foreground mt-0.5">
                {summary?.system.cache.misses || 0}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
