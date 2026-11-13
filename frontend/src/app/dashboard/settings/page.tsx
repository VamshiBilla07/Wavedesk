'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  MessageSquare,
  Webhook,
  Building2,
  Users,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface CompanySettings {
  id: string;
  name: string;
  phoneNumberId: string | null;
  wabaId: string | null;
  hasAccessToken: boolean;
  maskedAccessToken: string;
  hasAppSecret: boolean;
  createdAt: string;
}

interface WebhookInfo {
  webhookUrl: string;
  verifyToken: string;
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = useState('whatsapp');

  // WhatsApp form state
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Test connection state
  const [testResult, setTestResult] = useState<{ success: boolean; phoneName?: string } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Company profile state
  const [companyName, setCompanyName] = useState('');

  // Team state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('AGENT');
  const [userErrorMsg, setUserErrorMsg] = useState<string | null>(null);

  // Copy state
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Queries
  const { data: companyData, isLoading: isLoadingCompany } = useQuery<{ company: CompanySettings }>({
    queryKey: ['settings', 'company'],
    queryFn: async () => {
      const res = await api.get<{ company: CompanySettings }>('/settings/company');
      setCompanyName(res.company.name);
      if (res.company.phoneNumberId) setPhoneNumberId(res.company.phoneNumberId);
      if (res.company.wabaId) setWabaId(res.company.wabaId);
      return res;
    },
  });

  const { data: webhookData } = useQuery<WebhookInfo>({
    queryKey: ['settings', 'webhook'],
    queryFn: () => api.get<WebhookInfo>('/settings/webhook'),
  });

  const { data: usersData } = useQuery<{ users: TeamUser[] }>({
    queryKey: ['settings', 'users'],
    queryFn: () => api.get<{ users: TeamUser[] }>('/settings/users'),
  });

  // Mutations
  const updateWhatsappMutation = useMutation({
    mutationFn: async () => {
      return api.put('/settings/whatsapp', {
        phoneNumberId,
        wabaId,
        accessToken,
        appSecret,
      });
    },
    onSuccess: () => {
      setSaveSuccessMsg('WhatsApp credentials securely encrypted and saved!');
      setSaveErrorMsg(null);
      setAccessToken('');
      setAppSecret('');
      queryClient.invalidateQueries({ queryKey: ['settings', 'company'] });
    },
    onError: (err: any) => {
      setSaveErrorMsg(err.message || 'Failed to save credentials');
      setSaveSuccessMsg(null);
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      return api.post<{ success: boolean; phoneName?: string }>('/settings/whatsapp/test', {
        phoneNumberId: phoneNumberId || undefined,
        accessToken: accessToken || undefined,
      });
    },
    onSuccess: (data) => {
      setTestResult(data);
      setTestError(null);
    },
    onError: (err: any) => {
      setTestError(err.message || 'Connection test failed');
      setTestResult(null);
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async () => {
      return api.put('/settings/company', { name: companyName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'company'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      alert('Company profile updated successfully!');
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      return api.post('/settings/users', {
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
      setIsUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setUserErrorMsg(null);
    },
    onError: (err: any) => {
      setUserErrorMsg(err.message || 'Failed to create user');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/settings/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
    },
  });

  const copyToClipboard = (text: string, isUrl: boolean) => {
    navigator.clipboard.writeText(text);
    if (isUrl) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure your WhatsApp Cloud API credentials, webhooks, company details, and team
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 max-w-lg mb-4 h-auto p-1.5 gap-1">
          <TabsTrigger value="whatsapp">WhatsApp API</TabsTrigger>
          <TabsTrigger value="webhook">Webhooks</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        {/* Tab 1: WhatsApp Credentials */}
        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <CardTitle>Meta WhatsApp Cloud API Connection</CardTitle>
              </div>
              <CardDescription>
                Tokens and secrets are encrypted with AES-256-GCM before storage. They are never exposed in plaintext.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {saveSuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm border border-emerald-500/20 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}
              {saveErrorMsg && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saveErrorMsg}</span>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phoneId" required>
                    Phone Number ID
                  </Label>
                  <Input
                    id="phoneId"
                    placeholder="e.g. 102938475610293"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="wabaId" required>
                    WhatsApp Business Account ID (WABA ID)
                  </Label>
                  <Input
                    id="wabaId"
                    placeholder="e.g. 987654321098765"
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="accessToken" required>
                    Meta System User Access Token
                  </Label>
                  {companyData?.company.hasAccessToken && (
                    <span className="text-xs text-muted-foreground font-mono">
                      Current: {companyData.company.maskedAccessToken}
                    </span>
                  )}
                </div>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder={
                    companyData?.company.hasAccessToken
                      ? '•••••••••••••••••••••••••••• (Leave blank to keep existing)'
                      : 'EAAB...'
                  }
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="appSecret" required>
                    Meta App Secret
                  </Label>
                  {companyData?.company.hasAppSecret && (
                    <span className="text-xs text-muted-foreground">Configured</span>
                  )}
                </div>
                <Input
                  id="appSecret"
                  type="password"
                  placeholder={
                    companyData?.company.hasAppSecret
                      ? '•••••••••••••••• (Leave blank to keep existing)'
                      : '32-character App Secret'
                  }
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                />
              </div>

              {testResult && (
                <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm border border-emerald-500/20">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    WhatsApp Cloud API Connection Verified!
                  </div>
                  {testResult.phoneName && (
                    <div className="text-xs mt-1">Verified Display Name: {testResult.phoneName}</div>
                  )}
                </div>
              )}

              {testError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{testError}</span>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between border-t pt-4">
              <Button
                variant="outline"
                onClick={() => testConnectionMutation.mutate()}
                isLoading={testConnectionMutation.isPending}
                className="w-full sm:w-auto"
              >
                Test Connection
              </Button>
              <Button
                onClick={() => updateWhatsappMutation.mutate()}
                isLoading={updateWhatsappMutation.isPending}
                className="w-full sm:w-auto"
              >
                Save Credentials
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Tab 2: Webhooks */}
        <TabsContent value="webhook" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Webhook className="w-5 h-5 text-primary" />
                <CardTitle>Meta Webhook Configuration</CardTitle>
              </div>
              <CardDescription>
                Copy these details into your Meta App Dashboard under WhatsApp &gt; Configuration &gt; Callback URL.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Callback URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={webhookData?.webhookUrl || ''} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(webhookData?.webhookUrl || '', true)}
                  >
                    {copiedUrl ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Verify Token</Label>
                <div className="flex gap-2">
                  <Input readOnly value={webhookData?.verifyToken || ''} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(webhookData?.verifyToken || '', false)}
                  >
                    {copiedToken ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-muted/30 text-xs text-muted-foreground space-y-2">
                <div className="font-semibold text-foreground">Webhook Subscription Fields:</div>
                <p>
                  Ensure you subscribe to the <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">messages</code> field in your Meta Developer App settings so that incoming messages, read receipts, and delivery statuses update in real time.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Company Profile */}
        <TabsContent value="company" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <CardTitle>Company Profile</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5 max-w-md">
                <Label htmlFor="cName">Company / Workspace Name</Label>
                <Input
                  id="cName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button
                onClick={() => updateCompanyMutation.mutate()}
                isLoading={updateCompanyMutation.isPending}
              >
                Save Profile
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Tab 4: Team Members */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <CardTitle>Team Members</CardTitle>
                </div>
                <CardDescription>Manage users with access to your Wavedesk company dashboard</CardDescription>
              </div>
              <Button onClick={() => setIsUserModalOpen(true)} size="sm" className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Member
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData?.users?.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'OWNER' ? 'default' : 'outline'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {u.role !== 'OWNER' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`Remove user "${u.name}"?`)) {
                                deleteUserMutation.mutate(u.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Add User Modal */}
          {isUserModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsUserModalOpen(false)} />
              <div className="relative w-full max-w-md bg-card border rounded-2xl shadow-xl p-6 z-10 space-y-4">
                <h3 className="font-bold text-lg">Add Team Member</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createUserMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  {userErrorMsg && (
                    <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                      {userErrorMsg}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="uName" required>Name</Label>
                    <Input
                      id="uName"
                      placeholder="Jane Agent"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="uEmail" required>Email</Label>
                    <Input
                      id="uEmail"
                      type="email"
                      placeholder="agent@company.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="uPass" required>Password (min. 8 chars)</Label>
                    <Input
                      id="uPass"
                      type="password"
                      placeholder="••••••••"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="uRole">Role</Label>
                    <Select
                      id="uRole"
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                    >
                      <option value="AGENT">AGENT (Chat and customer access)</option>
                      <option value="ADMIN">ADMIN (Full campaign, template, and settings access)</option>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsUserModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" isLoading={createUserMutation.isPending}>
                      Create Account
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
