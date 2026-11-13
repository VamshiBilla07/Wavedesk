'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import {
  MessageSquare,
  Search,
  Send,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  FileCode2,
  Lock,
  Phone,
  Mail,
  User,
  Tag as TagIcon,
  FolderTree,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatPhone, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useSocket } from '@/components/socket-provider';

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

interface CustomerSummary {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  optedOut: boolean;
  unreadCount: number;
  lastMessageAt: string | null;
  lastCustomerMessageAt: string | null;
  isWindowOpen: boolean;
  contactType: ContactTypeItem | null;
  tags: TagItem[];
}

interface MessageItem {
  id: string;
  companyId: string;
  customerId: string;
  waMessageId: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  body: string | null;
  templateName: string | null;
  mediaUrl: string | null;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  errorCode: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

interface ConversationItem {
  customer: CustomerSummary;
  lastMessage: MessageItem | null;
}

function InboxContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get('customerId');
  const { isConnected } = useSocket();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customerIdParam || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Conversations List
  const { data: convData, isLoading: isLoadingConvs } = useQuery<{ conversations: ConversationItem[] }>({
    queryKey: ['conversations', { unreadOnly, search: searchTerm }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (unreadOnly) params.set('unreadOnly', 'true');
      if (searchTerm) params.set('search', searchTerm);
      return api.get(`/messages/conversations?${params.toString()}`);
    },
  });

  // Auto-select first customer if none selected
  useEffect(() => {
    if (!selectedCustomerId && convData?.conversations && convData.conversations.length > 0) {
      setSelectedCustomerId(convData.conversations[0].customer.id);
    }
  }, [convData, selectedCustomerId]);

  // 2. Fetch Active Conversation Message Thread
  const { data: threadData, isLoading: isLoadingThread } = useQuery<{
    customer: CustomerSummary;
    messages: MessageItem[];
    isWindowOpen: boolean;
  }>({
    queryKey: ['messages', selectedCustomerId],
    queryFn: () => api.get(`/messages/${selectedCustomerId}`),
    enabled: Boolean(selectedCustomerId),
  });

  // Mark as read when thread opens
  useEffect(() => {
    if (selectedCustomerId && threadData?.customer.unreadCount && threadData.customer.unreadCount > 0) {
      api.post(`/messages/${selectedCustomerId}/read`).then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      });
    }
  }, [selectedCustomerId, threadData?.customer.unreadCount, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadData?.messages]);

  // 3. Send Message Mutation
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!selectedCustomerId) return;
      return api.post<{ message: MessageItem }>(`/messages/${selectedCustomerId}`, {
        type: 'TEXT',
        body: text,
      });
    },
    onMutate: async (text) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['messages', selectedCustomerId] });
      const previous = queryClient.getQueryData(['messages', selectedCustomerId]);

      if (previous && selectedCustomerId) {
        const optimisticMsg: MessageItem = {
          id: `temp_${Date.now()}`,
          companyId: '',
          customerId: selectedCustomerId,
          waMessageId: null,
          direction: 'OUTBOUND',
          type: 'TEXT',
          body: text,
          templateName: null,
          mediaUrl: null,
          status: 'PENDING',
          errorCode: null,
          errorMessage: null,
          sentAt: null,
          deliveredAt: null,
          readAt: null,
          createdAt: new Date().toISOString(),
        };

        queryClient.setQueryData<{
          customer: CustomerSummary;
          messages: MessageItem[];
          isWindowOpen: boolean;
        }>(['messages', selectedCustomerId], (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: [...old.messages, optimisticMsg],
          };
        });
      }

      setMessageText('');
      return { previous };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedCustomerId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || sendMutation.isPending) return;
    sendMutation.mutate(messageText.trim());
  };

  const activeCustomer = threadData?.customer || convData?.conversations?.find((c) => c.customer.id === selectedCustomerId)?.customer;
  const isWindowOpen = threadData?.isWindowOpen ?? false;

  return (
    <div className="h-[calc(100vh-6rem)] flex rounded-2xl border bg-card overflow-hidden shadow-sm">
      {/* =========================================================================
          LEFT PANE: Customer Conversations List
         ========================================================================= */}
      <div className="w-80 sm:w-88 border-r flex flex-col shrink-0 bg-muted/10">
        {/* Search & Filter Header */}
        <div className="p-3 border-b space-y-2 bg-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">Conversations</span>
              {isConnected && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <button
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                unreadOnly
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Unread only
            </button>
          </div>
        </div>

        {/* Conversation Items List */}
        <div className="flex-1 overflow-y-auto divide-y">
          {isLoadingConvs ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading chats...</div>
          ) : convData?.conversations?.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No conversations yet. Inbound messages from WhatsApp will appear here automatically.
            </div>
          ) : (
            convData?.conversations?.map((item) => {
              const isSelected = item.customer.id === selectedCustomerId;
              const lastBody = item.lastMessage?.body || (item.lastMessage?.type === 'TEMPLATE' ? 'Template message' : 'Media file');

              return (
                <div
                  key={item.customer.id}
                  onClick={() => setSelectedCustomerId(item.customer.id)}
                  className={`p-3 cursor-pointer transition-colors flex items-start gap-3 select-none ${
                    isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/40'
                  }`}
                >
                  <Avatar name={item.customer.name || item.customer.phone} size="md" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-xs truncate text-foreground">
                        {item.customer.name || formatPhone(item.customer.phone)}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {item.customer.lastMessageAt ? formatDate(item.customer.lastMessageAt).split(',')[0] : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-xs text-muted-foreground truncate leading-snug">
                        {lastBody || 'No messages yet'}
                      </p>
                      {item.customer.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                          {item.customer.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Tag preview */}
                    {item.customer.tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5 overflow-hidden">
                        {item.customer.tags.slice(0, 2).map((t) => (
                          <span
                            key={t.id}
                            className="px-1.5 py-0.2 rounded text-[9px] font-medium text-white"
                            style={{ backgroundColor: t.color || '#10B981' }}
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* =========================================================================
          CENTER PANE: Message History Thread & Composer
         ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {selectedCustomerId && activeCustomer ? (
          <>
            {/* Thread Header */}
            <div className="h-14 border-b px-4 flex items-center justify-between bg-card shrink-0">
              <div className="flex items-center gap-3">
                <Avatar name={activeCustomer.name || activeCustomer.phone} size="sm" />
                <div>
                  <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                    <span>{activeCustomer.name || formatPhone(activeCustomer.phone)}</span>
                    {activeCustomer.contactType && (
                      <span
                        className="px-1.5 py-0.2 rounded text-[10px] font-medium"
                        style={{
                          backgroundColor: `${activeCustomer.contactType.color || '#3B82F6'}20`,
                          color: activeCustomer.contactType.color || '#3B82F6',
                        }}
                      >
                        {activeCustomer.contactType.name}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {formatPhone(activeCustomer.phone)}
                  </div>
                </div>
              </div>

              {/* 24-hr badge */}
              <div>
                {isWindowOpen ? (
                  <Badge variant="success" className="text-[10px] py-0.5">
                    24h Window Open
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] py-0.5 text-muted-foreground border-amber-500/40 text-amber-600 dark:text-amber-400">
                    <Lock className="w-3 h-3 mr-1" />
                    24h Window Closed
                  </Badge>
                )}
              </div>
            </div>

            {/* Chat Thread Bubbles */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
              {isLoadingThread ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Loading chat history...</div>
              ) : threadData?.messages?.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-primary" />
                  <p className="text-sm font-medium">No messages yet in this conversation</p>
                  <p className="text-xs mt-1">Send a message below or await incoming WhatsApp reply.</p>
                </div>
              ) : (
                threadData?.messages?.map((msg) => {
                  const isOutbound = msg.direction === 'OUTBOUND';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-xs break-words ${
                          isOutbound
                            ? 'bg-primary text-primary-foreground rounded-br-xs'
                            : 'bg-card border text-foreground rounded-bl-xs'
                        }`}
                      >
                        {msg.type === 'TEMPLATE' && (
                          <div className="flex items-center gap-1 font-semibold text-[10px] mb-1 opacity-80 uppercase tracking-wider">
                            <FileCode2 className="w-3 h-3" />
                            Template: {msg.templateName}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>

                        <div
                          className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${
                            isOutbound ? 'text-primary-foreground/75' : 'text-muted-foreground'
                          }`}
                        >
                          <span>{formatDate(msg.createdAt).split(',')[1] || formatDate(msg.createdAt)}</span>

                          {/* Outbound Status Ticks Indicator */}
                          {isOutbound && (
                            <span>
                              {msg.status === 'PENDING' && (
                                <Clock className="w-3 h-3 text-primary-foreground/60 animate-spin" />
                              )}
                              {msg.status === 'SENT' && (
                                <Check className="w-3.5 h-3.5 text-primary-foreground/80" />
                              )}
                              {msg.status === 'DELIVERED' && (
                                <CheckCheck className="w-3.5 h-3.5 text-primary-foreground/90" />
                              )}
                              {msg.status === 'READ' && (
                                <CheckCheck className="w-3.5 h-3.5 text-blue-300 font-bold" />
                              )}
                              {msg.status === 'FAILED' && (
                                <span title={msg.errorMessage || 'Failed to send'}>
                                  <AlertCircle className="w-3.5 h-3.5 text-red-300" />
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer Section */}
            <div className="p-3 border-t bg-card shrink-0 space-y-2">
              {/* 24-hour window restriction alert */}
              {!isWindowOpen && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">24-hour customer window is closed: </span>
                    Meta restricts free-form messaging after 24 hours of customer inactivity. You must send an approved Meta Template to re-open the conversation.
                  </div>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                <Textarea
                  placeholder={
                    isWindowOpen
                      ? 'Type your WhatsApp reply... (Press Enter to send)'
                      : 'Free text disabled: window closed. Use approved Meta Templates.'
                  }
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  disabled={!isWindowOpen || sendMutation.isPending}
                  className="min-h-[50px] max-h-32 text-xs"
                />

                <Button
                  type="submit"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  disabled={!isWindowOpen || !messageText.trim() || sendMutation.isPending}
                  isLoading={sendMutation.isPending}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-3 text-primary/30" />
            <h3 className="font-semibold text-base text-foreground">Select a Conversation</h3>
            <p className="text-xs max-w-sm mt-1">
              Choose an active chat from the left panel or search by customer name and phone.
            </p>
          </div>
        )}
      </div>

      {/* =========================================================================
          RIGHT PANE: Customer Details, Tags & Attributes
         ========================================================================= */}
      {selectedCustomerId && activeCustomer && (
        <div className="w-72 border-l p-4 flex flex-col shrink-0 bg-card overflow-y-auto hidden lg:flex space-y-5">
          <div className="text-center pb-4 border-b">
            <Avatar name={activeCustomer.name || activeCustomer.phone} size="lg" className="mx-auto mb-2" />
            <h3 className="font-bold text-sm text-foreground">
              {activeCustomer.name || 'Unnamed Contact'}
            </h3>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              {formatPhone(activeCustomer.phone)}
            </p>
          </div>

          {/* Contact Details */}
          <div className="space-y-3 text-xs">
            <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
              Contact Info
            </span>

            <div className="flex items-center gap-2.5 text-foreground">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono">{formatPhone(activeCustomer.phone)}</span>
            </div>

            {activeCustomer.email && (
              <div className="flex items-center gap-2.5 text-foreground">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{activeCustomer.email}</span>
              </div>
            )}
          </div>

          {/* Contact Type */}
          <div className="space-y-2 text-xs border-t pt-3">
            <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
              Contact Type
            </span>
            <div>
              {activeCustomer.contactType ? (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                  style={{
                    backgroundColor: `${activeCustomer.contactType.color || '#3B82F6'}20`,
                    color: activeCustomer.contactType.color || '#3B82F6',
                  }}
                >
                  <FolderTree className="w-3.5 h-3.5 mr-1" />
                  {activeCustomer.contactType.name}
                </span>
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2 text-xs border-t pt-3">
            <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
              Assigned Tags
            </span>
            <div className="flex flex-wrap gap-1.5">
              {activeCustomer.tags.length > 0 ? (
                activeCustomer.tags.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                    style={{ backgroundColor: t.color || '#10B981' }}
                  >
                    <TagIcon className="w-3 h-3 mr-1" />
                    {t.name}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground">No tags assigned</span>
              )}
            </div>
          </div>

          {/* Messaging Window Info */}
          <div className="space-y-2 text-xs border-t pt-3">
            <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
              Session Telemetry
            </span>
            <div className="space-y-1 text-muted-foreground text-[11px]">
              <div>Last Customer Msg: {activeCustomer.lastCustomerMessageAt ? formatDate(activeCustomer.lastCustomerMessageAt) : 'Never'}</div>
              <div>Window Status: {isWindowOpen ? 'Active (Open)' : 'Expired (Closed)'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading inbox...</div>}>
      <InboxContent />
    </React.Suspense>
  );
}
