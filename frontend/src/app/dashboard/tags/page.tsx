'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag as TagIcon, Plus, Edit2, Trash2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface TagItem {
  id: string;
  name: string;
  color: string | null;
  _count?: { customers: number };
}

const PRESET_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#14B8A6', '#6366F1', '#EC4899'];

export default function TagsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ tags: TagItem[] }>({
    queryKey: ['tags'],
    queryFn: () => api.get<{ tags: TagItem[] }>('/tags'),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingTag) {
        return api.patch(`/tags/${editingTag.id}`, { name, color });
      }
      return api.post('/tags', { name, color });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to save tag');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });

  const openCreateModal = () => {
    setEditingTag(null);
    setName('');
    setColor(PRESET_COLORS[0]);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (tag: TagItem) => {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color || PRESET_COLORS[0]);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTag(null);
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
          <h2 className="text-2xl font-bold tracking-tight">Customer Tags</h2>
          <p className="text-sm text-muted-foreground">
            Create tags to label and target customer segments in bulk campaigns and the inbox
          </p>
        </div>
        <Button onClick={openCreateModal} className="shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          Create Tag
        </Button>
      </div>

      {/* Main Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag Name</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Tagged Customers</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Loading tags...
                  </TableCell>
                </TableRow>
              ) : data?.tags?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    No tags created yet. Click &quot;Create Tag&quot; above to create one.
                  </TableCell>
                </TableRow>
              ) : (
                data?.tags?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-semibold">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-white shadow-sm"
                        style={{ backgroundColor: t.color || '#10B981' }}
                      >
                        <TagIcon className="w-3 h-3" />
                        {t.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-full border shadow-sm"
                          style={{ backgroundColor: t.color || '#10B981' }}
                        />
                        <span className="text-xs font-mono text-muted-foreground">
                          {t.color || '#10B981'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>{t._count?.customers || 0} customers</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(t)}
                        title="Edit tag"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Delete tag "${t.name}"?`)) {
                            deleteMutation.mutate(t.id);
                          }
                        }}
                        title="Delete tag"
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
            <h3 className="font-bold text-lg">{editingTag ? 'Edit Tag' : 'Create New Tag'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="tagName" required>
                  Tag Name
                </Label>
                <Input
                  id="tagName"
                  placeholder="e.g. High Priority"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Badge Color</Label>
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
                  {editingTag ? 'Save Changes' : 'Create Tag'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
