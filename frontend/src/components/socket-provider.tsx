'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getSocket,
  connectSocket,
  disconnectSocket,
  TypedSocket,
  MessagePayload,
  CustomerPayload,
} from '@/lib/socket';

interface SocketContextValue {
  socket: TypedSocket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [socketInstance, setSocketInstance] = useState<TypedSocket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const socket = connectSocket();
    setSocketInstance(socket);

    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onConnectError = (err: Error) => {
      console.warn('[Socket.io] Handshake connection error:', err.message);
      setIsConnected(false);
    };

    // Event: Inbound / Outbound Message Created
    const onMessageNew = (payload: { message: MessagePayload; customer: CustomerPayload }) => {
      const { message, customer } = payload;

      // 1. Invalidate conversations list so unread badges, snippet, and lastMessageAt update
      queryClient.invalidateQueries({ queryKey: ['conversations'] });

      // 2. Optimistically update thread if messages query is cached for this customer
      queryClient.setQueryData<{
        customer: CustomerPayload;
        messages: MessagePayload[];
        isWindowOpen: boolean;
      }>(['messages', message.customerId], (old) => {
        if (!old) return old;

        // Prevent duplicate if already exists (e.g. from optimistic send)
        const alreadyExists = old.messages.some(
          (m) => m.id === message.id || (m.waMessageId && m.waMessageId === message.waMessageId)
        );

        if (alreadyExists) {
          return {
            ...old,
            customer: { ...old.customer, ...customer },
            messages: old.messages.map((m) =>
              m.id === message.id || (m.waMessageId && m.waMessageId === message.waMessageId)
                ? { ...m, ...message }
                : m
            ),
          };
        }

        return {
          ...old,
          customer: { ...old.customer, ...customer },
          messages: [...old.messages, message],
        };
      });

      // 3. Invalidate customers table list
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    };

    // Event: Status transition (PENDING -> SENT -> DELIVERED -> READ -> FAILED)
    const onMessageStatus = (payload: {
      messageId: string;
      waMessageId: string | null;
      status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
      sentAt?: string | null;
      deliveredAt?: string | null;
      readAt?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    }) => {
      // Find all queries matching ['messages'] and update status live
      queryClient.setQueriesData<{
        customer: CustomerPayload;
        messages: MessagePayload[];
        isWindowOpen: boolean;
      }>(
        { queryKey: ['messages'] },
        (old) => {
          if (!old) return old;
          const updatedMessages = old.messages.map((msg) => {
            if (msg.id === payload.messageId || (payload.waMessageId && msg.waMessageId === payload.waMessageId)) {
              return {
                ...msg,
                status: payload.status,
                waMessageId: payload.waMessageId || msg.waMessageId,
                sentAt: payload.sentAt || msg.sentAt,
                deliveredAt: payload.deliveredAt || msg.deliveredAt,
                readAt: payload.readAt || msg.readAt,
                errorCode: payload.errorCode !== undefined ? payload.errorCode : msg.errorCode,
                errorMessage: payload.errorMessage !== undefined ? payload.errorMessage : msg.errorMessage,
              };
            }
            return msg;
          });
          return { ...old, messages: updatedMessages };
        }
      );

      // Invalidate conversations to refresh preview status
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    // Event: Customer updated (tags, opt-out, unread clear, profile change)
    const onCustomerUpdated = (payload: { customer: CustomerPayload }) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });

      queryClient.setQueryData<{
        customer: CustomerPayload;
        messages: MessagePayload[];
        isWindowOpen: boolean;
      }>(['messages', payload.customer.id], (old) => {
        if (!old) return old;
        return {
          ...old,
          customer: { ...old.customer, ...payload.customer },
        };
      });
    };

    // Event: Template status approved/rejected from Meta
    const onTemplateStatus = () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    };

    // Event: Campaign batch progress
    const onCampaignProgress = () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('message:new', onMessageNew);
    socket.on('message:status', onMessageStatus);
    socket.on('customer:updated', onCustomerUpdated);
    socket.on('template:status', onTemplateStatus);
    socket.on('campaign:progress', onCampaignProgress);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('message:new', onMessageNew);
      socket.off('message:status', onMessageStatus);
      socket.off('customer:updated', onCustomerUpdated);
      socket.off('template:status', onTemplateStatus);
      socket.off('campaign:progress', onCampaignProgress);
      disconnectSocket();
    };
  }, [queryClient]);

  const value = useMemo(
    () => ({
      socket: socketInstance,
      isConnected,
    }),
    [socketInstance, isConnected]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export default SocketProvider;
