'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Plus,
  FileSpreadsheet,
  Edit2,
  Trash2,
  MessageSquare,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatPhone, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ImportExportModal } from '@/components/ui/import-export-modal';

interface TagItem {
  id: string;
  name: string;
  color: string | null;
}

interface ContactTypeItem {
  id: string;
  name: string;
  color: string | null;
}

interface CustomerItem {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  optedOut: boolean;
  unreadCount: number;
  lastMessageAt: string | null;
  lastCustomerMessageAt: string | null;
  contactType: ContactTypeItem | null;
  tags: TagItem[];
  createdAt: string;
}

export default function CustomersPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('');
  const [selectedContactTypeId, setSelectedContactTypeId] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);

  // Form states
  const [formPhone, setFormPhone] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formContactTypeId, setFormContactTypeId] = useState('');
  const [formTagIds, setFormTagIds] = useState<string[]>([]);
  const [formOptedOut, setFormOptedOut] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: customerData, isLoading } = useQuery<{ customers: CustomerItem[]; total: number }>({
    queryKey: ['customers', { search, selectedTagId, selectedContactTypeId }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedTagId) params.set('tagId', selectedTagId);
      if (selectedContactTypeId) params.set('contactTypeId', selectedContactTypeId);
      return api.get(`/customers?${params.toString()}`);
    },
  });

  const { data: tagData } = useQuery<{ tags: TagItem[] }>({
    queryKey: ['tags'],
    queryFn: () => api.get('/tags'),
  });

  const { data: typeData } = useQuery<{ contactTypes: ContactTypeItem[] }>({
    queryKey: ['contact-types'],
    queryFn: () => api.get('/contact-types'),
  });

  // Mutations
  const saveCustomerMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        phone: formPhone,
        name: formName || undefined,
        email: formEmail || undefined,
        contactTypeId: formContactTypeId || null,
        tagIds: formTagIds,
        optedOut: formOptedOut,
      };

      if (editingCustomer) {
        return api.patch(`/customers/${editingCustomer.id}`, payload);
      }
      return api.post('/customers', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      closeCustomerModal();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to save customer');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormPhone('');
    setFormName('');
    setFormEmail('');
    setFormContactTypeId('');
    setFormTagIds([]);
    setFormOptedOut(false);
    setFormError(null);
    setIsCustomerModalOpen(true);
  };

  const openEditModal = (c: CustomerItem) => {
    setEditingCustomer(c);
    setFormPhone(c.phone);
    setFormName(c.name || '');
    setFormEmail(c.email || '');
    setFormContactTypeId(c.contactType?.id || '');
    setFormTagIds(c.tags.map((t) => t.id));
    setFormOptedOut(c.optedOut);
    setFormError(null);
    setIsCustomerModalOpen(true);
  };

  const closeCustomerModal = () => {
    setIsCustomerModalOpen(false);
    setEditingCustomer(null);
    setFormError(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPhone.trim()) {
      setFormError('Phone number is required');
      return;
    }
    saveCustomerMutation.mutate();
  };

  const toggleTagSelection = (id: string) => {
    setFormTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customer Directory</h2>
          <p className="text-sm text-muted-foreground">
            Manage your WhatsApp customer audience, tags, and segmentation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Import / Export
          </Button>
          <Button onClick={openCreateModal} className="shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            <Select
              value={selectedContactTypeId}
              onChange={(e) => setSelectedContactTypeId(e.target.value)}
              className="w-44"
            >
              <option value="">All Contact Types</option>
              {typeData?.contactTypes?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>

            <Select
              value={selectedTagId}
              onChange={(e) => setSelectedTagId(e.target.value)}
              className="w-40"
            >
              <option value="">All Tags</option>
              {tagData?.tags?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact Type</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>24-Hour Window</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading customers...
                  </TableCell>
                </TableRow>
              ) : customerData?.customers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No customers found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                customerData?.customers?.map((c) => {
                  const isWindowOpen = c.lastCustomerMessageAt
                    ? Date.now() - new Date(c.lastCustomerMessageAt).getTime() <= 24 * 60 * 60 * 1000
                    : false;

                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-semibold text-foreground">
                          {c.name || 'Unnamed Contact'}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {formatPhone(c.phone)}
                        </div>
                        {c.email && (
                          <div className="text-xs text-muted-foreground">{c.email}</div>
                        )}
                      </TableCell>

                      <TableCell>
                        {c.contactType ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: `${c.contactType.color || '#3B82F6'}20`,
                              color: c.contactType.color || '#3B82F6',
                            }}
                          >
                            {c.contactType.name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {c.tags.length > 0 ? (
                            c.tags.map((t) => (
                              <span
                                key={t.id}
                                className="px-1.5 py-0.5 rounded text-[11px] font-medium text-white shadow-xs"
                                style={{ backgroundColor: t.color || '#10B981' }}
                              >
                                {t.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {isWindowOpen ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Open
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            Closed
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {c.lastMessageAt ? formatDate(c.lastMessageAt) : 'Never'}
                      </TableCell>

                      <TableCell className="text-right space-x-1">
                        <Link href={`/dashboard/inbox?customerId=${c.id}`}>
                          <Button variant="ghost" size="icon" title="Chat in inbox">
                            <MessageSquare className="w-4 h-4 text-primary" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(c)}
                          title="Edit customer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Delete customer "${c.name || c.phone}"?`)) {
                              deleteMutation.mutate(c.id);
                            }
                          }}
                          title="Delete customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={closeCustomerModal} />
          <div className="relative w-full max-w-lg bg-card border rounded-2xl shadow-xl p-6 z-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h3>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="custPhone" required>
                  Phone Number (E.164 with Country Code)
                </Label>
                <Input
                  id="custPhone"
                  placeholder="e.g. 15551234567"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custName">Full Name</Label>
                <Input
                  id="custName"
                  placeholder="e.g. Jane Smith"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custEmail">Email Address</Label>
                <Input
                  id="custEmail"
                  type="email"
                  placeholder="e.g. jane@company.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custType">Contact Type</Label>
                <Select
                  id="custType"
                  value={formContactTypeId}
                  onChange={(e) => setFormContactTypeId(e.target.value)}
                >
                  <option value="">None (Uncategorized)</option>
                  {typeData?.contactTypes?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {tagData?.tags?.map((t) => {
                    const isSelected = formTagIds.includes(t.id);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => toggleTagSelection(t.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all border ${
                          isSelected
                            ? 'text-white shadow-sm ring-2 ring-primary/40'
                            : 'bg-muted text-muted-foreground border-transparent'
                        }`}
                        style={{
                          backgroundColor: isSelected ? (t.color || '#10B981') : undefined,
                        }}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {editingCustomer && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="optedOutCheck"
                    checked={formOptedOut}
                    onChange={(e) => setFormOptedOut(e.target.checked)}
                    className="rounded border-input h-4 w-4 text-primary"
                  />
                  <Label htmlFor="optedOutCheck" className="text-xs text-muted-foreground cursor-pointer">
                    Customer has opted out of WhatsApp messages
                  </Label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={closeCustomerModal}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saveCustomerMutation.isPending}>
                  {editingCustomer ? 'Update Customer' : 'Add Customer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import / Export Modal */}
      <ImportExportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
        }}
      />
    </div>
  );
}
