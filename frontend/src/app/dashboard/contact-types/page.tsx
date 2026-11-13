'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderTree, Plus, Edit2, Trash2, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface ContactType {
  id: string;
  name: string;
  color: string | null;
  _count?: { customers: number };
}

const PRESET_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#F43F5E', '#06B6D4', '#EC4899', '#64748B'];

export default function ContactTypesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<ContactType | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ contactTypes: ContactType[] }>({
    queryKey: ['contact-types'],
    queryFn: () => api.get<{ contactTypes: ContactType[] }>('/contact-types'),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingType) {
        return api.patch(`/contact-types/${editingType.id}`, { name, color });
      }
      return api.post('/contact-types', { name, color });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-types'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to save contact type');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/contact-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-types'] });
    },
  });

  const openCreateModal = () => {
    setEditingType(null);
    setName('');
    setColor(PRESET_COLORS[0]);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: ContactType) => {
    setEditingType(item);
    setName(item.name);
    setColor(item.color || PRESET_COLORS[0]);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingType(null);
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Contact Types</h2>
          <p className="text-sm text-muted-foreground">
            Segment your customers into relationship categories (e.g., Lead, VIP, Partner, Customer)
          </p>
        </div>
        <Button onClick={openCreateModal} className="shadow-sm w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Contact Type
        </Button>
      </div>

      {/* Main Table */}
      <Card>
        <CardContent className="p-0">
          <Table className="min-w-[500px]">
            <TableHeader>
              <TableRow>
                <TableHead>Category Name</TableHead>
                <TableHead>Color Preview</TableHead>
                <TableHead>Customers Assigned</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Loading contact types...
                  </TableCell>
                </TableRow>
              ) : data?.contactTypes?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    No contact types defined yet. Click &quot;Add Contact Type&quot; above to create one.
                  </TableCell>
                </TableRow>
              ) : (
                data?.contactTypes?.map((ct) => (
                  <TableRow key={ct.id}>
                    <TableCell className="font-semibold flex items-center gap-2">
                      <FolderTree className="w-4 h-4 text-muted-foreground" />
                      <span>{ct.name}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-full border shadow-sm"
                          style={{ backgroundColor: ct.color || '#3B82F6' }}
                        />
                        <span className="text-xs font-mono text-muted-foreground">
                          {ct.color || '#3B82F6'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>{ct._count?.customers || 0} customers</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(ct)}
                        title="Edit category"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Delete contact type "${ct.name}"?`)) {
                            deleteMutation.mutate(ct.id);
                          }
                        }}
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-md bg-card border rounded-2xl shadow-xl p-6 z-10 space-y-4">
            <h3 className="font-bold text-lg">
              {editingType ? 'Edit Contact Type' : 'Create Contact Type'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="typeName" required>
                  Name
                </Label>
                <Input
                  id="typeName"
                  placeholder="e.g. VIP Customer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Color Tag</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        color === c ? 'scale-110 border-primary ring-2 ring-primary/20' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saveMutation.isPending}>
                  {editingType ? 'Save Changes' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
