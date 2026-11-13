'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Ban,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  FileCode2,
  Tag as TagIcon,
  FolderTree,
  ChevronRight,
  ChevronLeft,
  Flame,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface CampaignStats {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  total: number;
}

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
}

interface CampaignItem {
  id: string;
  name: string;
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  total: number;
  audience: Record<string, unknown>;
  variableMap?: Record<string, string> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  template: {
    id: string;
    name: string;
    language: string;
    category: string;
    status: string;
  };
  stats?: CampaignStats;
}

interface TemplateOption {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: TemplateComponent[];
}

interface TagOption {
  id: string;
  name: string;
  color: string | null;
}

interface ContactTypeOption {
  id: string;
  name: string;
  color: string | null;
}

export default function CampaignsPage() {
  const queryClient = useQueryClient();

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Wizard Form State
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [variableMap, setVariableMap] = useState<Record<string, string>>({});
  const [audienceType, setAudienceType] = useState<'ALL' | 'TAGS' | 'CONTACT_TYPES'>('ALL');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedContactTypeIds, setSelectedContactTypeIds] = useState<string[]>([]);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // 1. Fetch Campaigns List
  const { data: campaignData, isLoading } = useQuery<{ campaigns: CampaignItem[] }>({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns'),
  });

  // 2. Fetch Approved Templates for Wizard
  const { data: templateData } = useQuery<{ templates: TemplateOption[] }>({
    queryKey: ['templates', { status: 'APPROVED' }],
    queryFn: () => api.get('/templates?status=APPROVED'),
    enabled: isWizardOpen,
  });

  // 3. Fetch Tags for Wizard
  const { data: tagData } = useQuery<{ tags: TagOption[] }>({
    queryKey: ['tags'],
    queryFn: () => api.get('/tags'),
    enabled: isWizardOpen && audienceType === 'TAGS',
  });

  // 4. Fetch Contact Types for Wizard
  const { data: contactTypeData } = useQuery<{ contactTypes: ContactTypeOption[] }>({
    queryKey: ['contact-types'],
    queryFn: () => api.get('/contact-types'),
    enabled: isWizardOpen && audienceType === 'CONTACT_TYPES',
  });

  // 5. Lifecycle Action Mutations
  const sendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/campaigns/${id}/send`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/campaigns/${id}/pause`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/campaigns/${id}/resume`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/campaigns/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  // 6. Create Campaign Mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      templateId: string;
      audience: unknown;
      variableMap: unknown;
    }) => {
      return api.post<{ campaign: CampaignItem }>('/campaigns', payload);
    },
    onSuccess: async (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setIsWizardOpen(false);
      resetWizard();
    },
    onError: (err: Error) => {
      setWizardError(err.message);
    },
  });

  const resetWizard = () => {
    setWizardStep(1);
    setCampaignName('');
    setSelectedTemplateId('');
    setVariableMap({});
    setAudienceType('ALL');
    setSelectedTagIds([]);
    setSelectedContactTypeIds([]);
    setWizardError(null);
  };

  const selectedTemplate = templateData?.templates?.find((t) => t.id === selectedTemplateId);

  // Extract variables like {{1}}, {{2}} from selected template
  const templateBodyText = selectedTemplate?.components?.find((c) => c.type === 'BODY')?.text || '';
  const detectedVariables: string[] = Array.from(
    new Set((templateBodyText.match(/{{\d+}}/g) || []).map((v: string) => v.replace(/[{}]/g, '')))
  ).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  const handleCreateSubmit = (shouldLaunchImmediately: boolean) => {
    setWizardError(null);

    const audiencePayload = {
      ...(audienceType === 'ALL' ? { all: true } : {}),
      ...(audienceType === 'TAGS' ? { tagIds: selectedTagIds } : {}),
      ...(audienceType === 'CONTACT_TYPES' ? { contactTypeIds: selectedContactTypeIds } : {}),
    };

    createCampaignMutation.mutate(
      {
        name: campaignName.trim(),
        templateId: selectedTemplateId,
        audience: audiencePayload,
        variableMap,
      },
      {
        onSuccess: (res) => {
          if (shouldLaunchImmediately && res?.campaign?.id) {
            sendMutation.mutate(res.campaign.id);
          }
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-sm text-muted-foreground">
            Throttled bulk WhatsApp outreach with real-time delivery funnels and resumable sending loops.
          </p>
        </div>

        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => {
            resetWizard();
            setIsWizardOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Campaign
        </Button>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardContent className="p-0">
          <Table className="min-w-[650px]">
            <TableHeader>
              <TableRow>
                <TableHead>Campaign Name</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-[220px]">Delivery Funnel</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                    Loading campaigns...
                  </TableCell>
                </TableRow>
              ) : campaignData?.campaigns?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-14 text-muted-foreground text-xs">
                    No campaigns created yet. Click &quot;New Campaign&quot; to launch a WhatsApp broadcast.
                  </TableCell>
                </TableRow>
              ) : (
                campaignData?.campaigns?.map((camp) => {
                  const stats = camp.stats || {
                    sent: 0,
                    delivered: 0,
                    read: 0,
                    failed: 0,
                    total: camp.total || 0,
                  };
                  const total = stats.total || 1;
                  const deliveredPct = Math.round(((stats.delivered - stats.read) / total) * 100);
                  const readPct = Math.round((stats.read / total) * 100);
                  const failedPct = Math.round((stats.failed / total) * 100);

                  return (
                    <TableRow key={camp.id}>
                      <TableCell className="font-semibold text-xs text-foreground">
                        {camp.name}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {camp.template?.name}
                      </TableCell>
                      <TableCell>
                        {camp.status === 'RUNNING' && (
                          <Badge variant="default" className="gap-1 text-[11px] py-0.5 bg-blue-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            Sending
                          </Badge>
                        )}
                        {camp.status === 'DRAFT' && (
                          <Badge variant="outline" className="text-[11px] py-0.5">
                            Draft
                          </Badge>
                        )}
                        {camp.status === 'PAUSED' && (
                          <Badge variant="warning" className="gap-1 text-[11px] py-0.5">
                            <Pause className="w-3 h-3" />
                            Paused
                          </Badge>
                        )}
                        {camp.status === 'COMPLETED' && (
                          <Badge variant="success" className="gap-1 text-[11px] py-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            Completed
                          </Badge>
                        )}
                        {camp.status === 'CANCELLED' && (
                          <Badge variant="destructive" className="gap-1 text-[11px] py-0.5">
                            <Ban className="w-3 h-3" />
                            Cancelled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* Live Delivery Funnel Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                            <div
                              style={{ width: `${readPct}%` }}
                              className="bg-blue-500 h-full transition-all duration-300"
                              title={`Read: ${stats.read}`}
                            />
                            <div
                              style={{ width: `${deliveredPct}%` }}
                              className="bg-emerald-500 h-full transition-all duration-300"
                              title={`Delivered: ${stats.delivered}`}
                            />
                            <div
                              style={{ width: `${failedPct}%` }}
                              className="bg-red-500 h-full transition-all duration-300"
                              title={`Failed: ${stats.failed}`}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>
                              {stats.sent} / {stats.total} sent
                            </span>
                            <span className="font-semibold text-foreground">
                              {stats.read} read ({readPct}%)
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(camp.createdAt).split(',')[0]}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Send / Launch Button */}
                          {camp.status === 'DRAFT' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1 text-emerald-600 hover:text-emerald-700"
                              onClick={() => sendMutation.mutate(camp.id)}
                              isLoading={sendMutation.isPending}
                            >
                              <Play className="w-3.5 h-3.5" />
                              Send
                            </Button>
                          )}

                          {/* Pause Button */}
                          {camp.status === 'RUNNING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1 text-amber-600 hover:text-amber-700"
                              onClick={() => pauseMutation.mutate(camp.id)}
                              isLoading={pauseMutation.isPending}
                            >
                              <Pause className="w-3.5 h-3.5" />
                              Pause
                            </Button>
                          )}

                          {/* Resume Button */}
                          {camp.status === 'PAUSED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1 text-blue-600 hover:text-blue-700"
                              onClick={() => resumeMutation.mutate(camp.id)}
                              isLoading={resumeMutation.isPending}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Resume
                            </Button>
                          )}

                          {/* Cancel Button */}
                          {(camp.status === 'RUNNING' || camp.status === 'PAUSED') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-red-500 hover:text-red-600"
                              onClick={() => {
                                if (confirm('Cancel this running campaign?')) {
                                  cancelMutation.mutate(camp.id);
                                }
                              }}
                              isLoading={cancelMutation.isPending}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* =========================================================================
          MULTI-STEP CAMPAIGN WIZARD MODAL
         ========================================================================= */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Wizard Header */}
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base">New Broadcast Campaign</h3>
              </div>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Step Stepper Indicator */}
            <div className="px-3 sm:px-6 py-2.5 sm:py-3 bg-muted/20 border-b flex items-center justify-between text-xs overflow-x-auto">
              <div className={`flex items-center gap-1.5 shrink-0 ${wizardStep >= 1 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">1</span>
                <span className={wizardStep === 1 ? 'inline' : 'hidden sm:inline'}>Details</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />

              <div className={`flex items-center gap-1.5 shrink-0 ${wizardStep >= 2 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">2</span>
                <span className={wizardStep === 2 ? 'inline' : 'hidden sm:inline'}>Template</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />

              <div className={`flex items-center gap-1.5 shrink-0 ${wizardStep >= 3 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">3</span>
                <span className={wizardStep === 3 ? 'inline' : 'hidden sm:inline'}>Audience</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />

              <div className={`flex items-center gap-1.5 shrink-0 ${wizardStep >= 4 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">4</span>
                <span className={wizardStep === 4 ? 'inline' : 'hidden sm:inline'}>Review</span>
              </div>
            </div>

            {/* Wizard Content Body */}
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4">
              {wizardError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                  {wizardError}
                </div>
              )}

              {/* STEP 1: CAMPAIGN DETAILS */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Campaign Name *</label>
                    <Input
                      placeholder="e.g. Black Friday VIP Blast"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="text-xs"
                      autoFocus
                    />
                    <p className="text-[11px] text-muted-foreground">
                      An internal name for your team to identify this broadcast campaign.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 2: TEMPLATE SELECTION & VARIABLE MAPPING */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Select Approved Template *</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => {
                        setSelectedTemplateId(e.target.value);
                        setVariableMap({});
                      }}
                      className="w-full h-9 px-3 rounded-lg border bg-background text-xs font-mono"
                    >
                      <option value="">-- Choose an approved template --</option>
                      {templateData?.templates?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.language}) • {t.category}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTemplate && (
                    <div className="p-3 rounded-xl bg-muted/40 border space-y-2 text-xs">
                      <span className="font-semibold text-muted-foreground uppercase text-[10px]">
                        Template Preview
                      </span>
                      <p className="text-foreground whitespace-pre-wrap leading-relaxed font-sans">
                        {templateBodyText}
                      </p>
                    </div>
                  )}

                  {/* Dynamic Variables Mapping */}
                  {detectedVariables.length > 0 && (
                    <div className="space-y-3 pt-2 border-t">
                      <span className="text-xs font-semibold">Map Dynamic Parameters</span>
                      <div className="space-y-2">
                        {detectedVariables.map((varNum) => (
                          <div key={varNum} className="flex items-center gap-3">
                            <span className="w-12 text-xs font-mono font-bold text-primary">
                              {`{{${varNum}}}`}
                            </span>
                            <select
                              value={variableMap[varNum] || 'name'}
                              onChange={(e) => {
                                setVariableMap({ ...variableMap, [varNum]: e.target.value });
                              }}
                              className="h-8 px-2 rounded-lg border bg-background text-xs flex-1"
                            >
                              <option value="name">Customer Name</option>
                              <option value="phone">Customer Phone</option>
                              <option value="email">Customer Email</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: AUDIENCE SELECTION */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Target Audience</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setAudienceType('ALL')}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          audienceType === 'ALL'
                            ? 'border-primary bg-primary/10 text-primary font-bold'
                            : 'hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        <Users className="w-5 h-5 mx-auto mb-1" />
                        <span className="text-xs">All Contacts</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAudienceType('TAGS')}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          audienceType === 'TAGS'
                            ? 'border-primary bg-primary/10 text-primary font-bold'
                            : 'hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        <TagIcon className="w-5 h-5 mx-auto mb-1" />
                        <span className="text-xs">By Tags</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAudienceType('CONTACT_TYPES')}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          audienceType === 'CONTACT_TYPES'
                            ? 'border-primary bg-primary/10 text-primary font-bold'
                            : 'hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        <FolderTree className="w-5 h-5 mx-auto mb-1" />
                        <span className="text-xs">By Category</span>
                      </button>
                    </div>
                  </div>

                  {/* Tag Multi-select */}
                  {audienceType === 'TAGS' && (
                    <div className="space-y-2 pt-2 border-t">
                      <span className="text-xs font-semibold">Select Tags:</span>
                      <div className="flex flex-wrap gap-2">
                        {tagData?.tags?.map((t) => {
                          const isSelected = selectedTagIds.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedTagIds(selectedTagIds.filter((id) => id !== t.id));
                                } else {
                                  setSelectedTagIds([...selectedTagIds, t.id]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-muted text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Contact Type Multi-select */}
                  {audienceType === 'CONTACT_TYPES' && (
                    <div className="space-y-2 pt-2 border-t">
                      <span className="text-xs font-semibold">Select Contact Categories:</span>
                      <div className="flex flex-wrap gap-2">
                        {contactTypeData?.contactTypes?.map((ct) => {
                          const isSelected = selectedContactTypeIds.includes(ct.id);
                          return (
                            <button
                              key={ct.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedContactTypeIds(selectedContactTypeIds.filter((id) => id !== ct.id));
                                } else {
                                  setSelectedContactTypeIds([...selectedContactTypeIds, ct.id]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-muted text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {ct.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Opted-out customers are automatically excluded from broadcasts.</span>
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & LAUNCH */}
              {wizardStep === 4 && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-xl border bg-muted/20 space-y-2.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Campaign:</span>
                      <span className="font-semibold">{campaignName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Template:</span>
                      <span className="font-semibold font-mono">{selectedTemplate?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Audience:</span>
                      <span className="font-semibold">{audienceType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Throttle Rate:</span>
                      <span className="font-semibold">20 messages / sec</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    You can launch the broadcast immediately or save it as a draft to send later.
                  </p>
                </div>
              )}
            </div>

            {/* Wizard Footer Controls */}
            <div className="p-4 border-t flex items-center justify-between shrink-0 bg-muted/10">
              {wizardStep > 1 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWizardStep((prev) => (Math.max(1, prev - 1) as 1 | 2 | 3 | 4))}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                {wizardStep < 4 ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (wizardStep === 1 && !campaignName.trim()) {
                        setWizardError('Campaign name is required');
                        return;
                      }
                      if (wizardStep === 2 && !selectedTemplateId) {
                        setWizardError('Please select an approved template');
                        return;
                      }
                      setWizardError(null);
                      setWizardStep((prev) => (Math.min(4, prev + 1) as 1 | 2 | 3 | 4));
                    }}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreateSubmit(false)}
                      isLoading={createCampaignMutation.isPending}
                    >
                      Save Draft
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleCreateSubmit(true)}
                      isLoading={createCampaignMutation.isPending || sendMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      Launch Now
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
