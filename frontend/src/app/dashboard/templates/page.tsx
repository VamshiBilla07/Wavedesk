'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCode2,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  PauseCircle,
  Trash2,
  Eye,
  Smartphone,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface TemplateComponentItem {
  type: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type: string; text: string }>;
}

interface TemplateItem {
  id: string;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED';
  components: TemplateComponentItem[];
  rejectReason?: string | null;
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);

  // Form State for Template Creator
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('MARKETING');
  const [formLanguage, setFormLanguage] = useState('en_US');
  const [formHeaderText, setFormHeaderText] = useState('');
  const [formBodyText, setFormBodyText] = useState('Hi {{1}}, thank you for your order! Your tracking number is {{2}}.');
  const [formFooterText, setFormFooterText] = useState('Reply STOP to unsubscribe');
  const [formButtons, setFormButtons] = useState<Array<{ type: string; text: string }>>([
    { type: 'QUICK_REPLY', text: 'Track Order' },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Fetch Templates
  const { data, isLoading } = useQuery<{ templates: TemplateItem[] }>({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates'),
  });

  // 2. Sync from Meta Mutation
  const syncMutation = useMutation({
    mutationFn: () => api.post('/templates/sync'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  // 3. Create Template Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      category: string;
      language: string;
      components: unknown[];
    }) => {
      return api.post('/templates', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // 4. Delete Template Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormCategory('MARKETING');
    setFormLanguage('en_US');
    setFormHeaderText('');
    setFormBodyText('');
    setFormFooterText('');
    setFormButtons([]);
    setFormError(null);
  };

  const handleNameChange = (val: string) => {
    // Convert to lowercase alphanumeric with underscores
    const sanitized = val.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    setFormName(sanitized);
  };

  const handleAddVariable = () => {
    // Count existing {{n}} in body
    const matches = formBodyText.match(/{{\d+}}/g) || [];
    const nextIndex = matches.length + 1;
    setFormBodyText((prev) => `${prev} {{${nextIndex}}}`);
  };

  const handleAddButton = () => {
    if (formButtons.length >= 3) return;
    setFormButtons([...formButtons, { type: 'QUICK_REPLY', text: `Button ${formButtons.length + 1}` }]);
  };

  const handleRemoveButton = (idx: number) => {
    setFormButtons(formButtons.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Template name is required');
      return;
    }

    if (!formBodyText.trim()) {
      setFormError('Body text is required');
      return;
    }

    // Build WhatsApp Meta components format
    const components: unknown[] = [];

    if (formHeaderText.trim()) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: formHeaderText.trim(),
      });
    }

    components.push({
      type: 'BODY',
      text: formBodyText.trim(),
    });

    if (formFooterText.trim()) {
      components.push({
        type: 'FOOTER',
        text: formFooterText.trim(),
      });
    }

    if (formButtons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: formButtons.map((b) => ({
          type: b.type,
          text: b.text.trim(),
        })),
      });
    }

    createMutation.mutate({
      name: formName.trim(),
      category: formCategory,
      language: formLanguage,
      components,
    });
  };

  // Filter templates
  const filteredTemplates = (data?.templates || []).filter((tpl) => {
    const matchesSearch = tpl.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || tpl.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || tpl.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Message Templates</h2>
          <p className="text-sm text-muted-foreground">
            Create, sync, and preview Meta-approved WhatsApp message templates for outreach and campaigns.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            isLoading={syncMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync from Meta
          </Button>

          <Button
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Template
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-card p-3 rounded-xl border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border bg-background text-xs w-full sm:w-auto"
          >
            <option value="ALL">All Categories</option>
            <option value="MARKETING">Marketing</option>
            <option value="UTILITY">Utility</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border bg-background text-xs w-full sm:w-auto"
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
            <option value="PAUSED">Paused</option>
          </select>
        </div>
      </div>

      {/* Templates Table */}
      <Card>
        <CardContent className="p-0">
          <Table className="min-w-[650px]">
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Body Snippet</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                    Loading templates...
                  </TableCell>
                </TableRow>
              ) : filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                    No message templates found. Click &quot;Sync from Meta&quot; or create your first template.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates.map((tpl) => {
                  const bodyComp = tpl.components?.find((c) => c.type === 'BODY');
                  const bodySnippet = bodyComp?.text || 'No text';

                  return (
                    <TableRow key={tpl.id}>
                      <TableCell className="font-semibold text-xs font-mono">
                        {tpl.name}
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-muted">
                          {tpl.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {tpl.language}
                      </TableCell>
                      <TableCell>
                        {tpl.status === 'APPROVED' && (
                          <Badge variant="success" className="gap-1 text-[11px] py-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </Badge>
                        )}
                        {tpl.status === 'PENDING' && (
                          <Badge variant="warning" className="gap-1 text-[11px] py-0.5">
                            <Clock className="w-3 h-3" />
                            Pending Review
                          </Badge>
                        )}
                        {tpl.status === 'REJECTED' && (
                          <Badge variant="destructive" className="gap-1 text-[11px] py-0.5" title={tpl.rejectReason || 'Rejected by Meta'}>
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </Badge>
                        )}
                        {tpl.status === 'PAUSED' && (
                          <Badge variant="outline" className="gap-1 text-[11px] py-0.5">
                            <PauseCircle className="w-3 h-3" />
                            Paused
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {bodySnippet}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setPreviewTemplate(tpl)}
                            title="Preview Template"
                          >
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => {
                              if (confirm(`Delete template "${tpl.name}"?`)) {
                                deleteMutation.mutate(tpl.id);
                              }
                            }}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
          TEMPLATE CREATOR MODAL WITH LIVE PHONE MOCKUP PREVIEW
         ========================================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-4xl rounded-2xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base">Create WhatsApp Template</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Form (Left) & Phone Preview (Right) */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
              {/* Left Form */}
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {formError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                    {formError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Template Name *</label>
                  <Input
                    placeholder="e.g. order_confirmation"
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="h-9 text-xs font-mono"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Lowercase letters, numbers, and underscores only.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION')}
                      className="w-full h-9 px-3 rounded-lg border bg-background text-xs"
                    >
                      <option value="MARKETING">Marketing</option>
                      <option value="UTILITY">Utility</option>
                      <option value="AUTHENTICATION">Authentication</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Language</label>
                    <select
                      value={formLanguage}
                      onChange={(e) => setFormLanguage(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border bg-background text-xs"
                    >
                      <option value="en_US">English (US)</option>
                      <option value="en_GB">English (UK)</option>
                      <option value="es_ES">Spanish (ES)</option>
                      <option value="pt_BR">Portuguese (BR)</option>
                      <option value="hi_IN">Hindi (IN)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Header (Optional)</label>
                  <Input
                    placeholder="e.g. Order Update"
                    value={formHeaderText}
                    onChange={(e) => setFormHeaderText(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold">Body Text *</label>
                    <button
                      type="button"
                      onClick={handleAddVariable}
                      className="text-[11px] text-primary hover:underline font-semibold"
                    >
                      + Add Variable
                    </button>
                  </div>
                  <Textarea
                    placeholder="Write your message. Use {{1}}, {{2}} for dynamic tags..."
                    value={formBodyText}
                    onChange={(e) => setFormBodyText(e.target.value)}
                    className="min-h-[100px] text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Footer (Optional)</label>
                  <Input
                    placeholder="e.g. Reply STOP to unsubscribe"
                    value={formFooterText}
                    onChange={(e) => setFormFooterText(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                {/* Buttons section */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold">Interactive Buttons</label>
                    {formButtons.length < 3 && (
                      <button
                        type="button"
                        onClick={handleAddButton}
                        className="text-[11px] text-primary hover:underline font-semibold"
                      >
                        + Add Button
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {formButtons.map((btn, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          placeholder="Button label..."
                          value={btn.text}
                          onChange={(e) => {
                            const updated = [...formButtons];
                            updated[idx].text = e.target.value;
                            setFormButtons(updated);
                          }}
                          className="h-8 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveButton(idx)}
                          className="text-muted-foreground hover:text-red-500 text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={createMutation.isPending}
                  >
                    Submit to Meta
                  </Button>
                </div>
              </form>

              {/* Right Live WhatsApp Mockup */}
              <div className="p-4 sm:p-6 bg-muted/20 flex flex-col items-center justify-center">
                <div className="w-full max-w-[280px] sm:max-w-[300px] rounded-3xl border-4 border-slate-700 bg-[#0B141A] shadow-xl overflow-hidden flex flex-col text-white">
                  {/* Phone Top Notch & WhatsApp App Bar */}
                  <div className="bg-[#1F2C34] p-3 flex items-center gap-2 border-b border-[#2A3942]">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">
                      W
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate leading-none">Wavedesk Business</div>
                      <div className="text-[9px] text-emerald-400">verified business</div>
                    </div>
                  </div>

                  {/* Chat Wallpaper Area */}
                  <div className="p-3 bg-[#0B141A] min-h-[320px] flex flex-col justify-end">
                    {/* Message Bubble */}
                    <div className="bg-[#005C4B] rounded-2xl rounded-tl-xs p-3 text-white text-xs shadow-md space-y-1.5 max-w-[95%]">
                      {/* Header */}
                      {formHeaderText && (
                        <div className="font-bold text-[11px] text-emerald-200">
                          {formHeaderText}
                        </div>
                      )}

                      {/* Body */}
                      <p className="whitespace-pre-wrap leading-relaxed text-[11px]">
                        {formBodyText || 'Message body text will appear here...'}
                      </p>

                      {/* Footer */}
                      {formFooterText && (
                        <div className="text-[9px] text-emerald-200/70 pt-0.5">
                          {formFooterText}
                        </div>
                      )}

                      {/* Timestamp & checks */}
                      <div className="flex items-center justify-end gap-1 text-[8px] text-emerald-200/60 pt-0.5">
                        <span>12:00 PM</span>
                        <CheckCircle2 className="w-2.5 h-2.5 text-blue-300" />
                      </div>
                    </div>

                    {/* Interactive Buttons Below Bubble */}
                    {formButtons.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {formButtons.map((btn, i) => (
                          <div
                            key={i}
                            className="bg-[#1F2C34] text-emerald-400 py-1.5 px-3 rounded-lg text-center text-[10px] font-semibold border border-[#2A3942] shadow-xs"
                          >
                            {btn.text || `Button ${i + 1}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" />
                  Live WhatsApp client preview
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TEMPLATE PREVIEW MODAL
         ========================================================================= */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-sm font-mono">{previewTemplate.name}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {previewTemplate.category} • {previewTemplate.language}
                </p>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#0B141A] p-4 rounded-xl text-white">
              <div className="bg-[#005C4B] rounded-2xl rounded-tl-xs p-3 text-xs shadow-md space-y-2">
                {previewTemplate.components?.map((comp, idx: number) => {
                  if (comp.type === 'HEADER') {
                    return (
                      <div key={idx} className="font-bold text-emerald-200 text-xs">
                        {comp.text}
                      </div>
                    );
                  }
                  if (comp.type === 'BODY') {
                    return (
                      <div key={idx} className="whitespace-pre-wrap leading-relaxed text-xs">
                        {comp.text}
                      </div>
                    );
                  }
                  if (comp.type === 'FOOTER') {
                    return (
                      <div key={idx} className="text-[10px] text-emerald-200/70">
                        {comp.text}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>

              {previewTemplate.components?.find((c) => c.type === 'BUTTONS')?.buttons && (
                <div className="mt-2 space-y-1">
                  {previewTemplate.components
                    .find((c) => c.type === 'BUTTONS')
                    ?.buttons?.map((b, i: number) => (
                      <div
                        key={i}
                        className="bg-[#1F2C34] text-emerald-400 py-1.5 px-3 rounded-lg text-center text-xs font-semibold border border-[#2A3942]"
                      >
                        {b.text}
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setPreviewTemplate(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
