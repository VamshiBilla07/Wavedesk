import { io, Socket } from 'socket.io-client';

export interface MessagePayload {
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

export interface CustomerPayload {
  id: string;
  companyId: string;
  phone: string;
  name: string | null;
  email: string | null;
  contactTypeId: string | null;
  optedOut: boolean;
  unreadCount: number;
  lastMessageAt: string | null;
  lastCustomerMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  contactType?: { id: string; name: string; color: string | null } | null;
  tags?: Array<{ id: string; name: string; color: string | null }>;
}

export interface ServerToClientEvents {
  'message:new': (payload: { message: MessagePayload; customer: CustomerPayload }) => void;
  'message:status': (payload: {
    messageId: string;
    waMessageId: string | null;
    status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
    sentAt?: string | null;
    deliveredAt?: string | null;
    readAt?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }) => void;
  'customer:updated': (payload: { customer: CustomerPayload }) => void;
  'campaign:progress': (payload: {
    campaignId: string;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    total: number;
  }) => void;
  'template:status': (payload: {
    templateId: string;
    status: string;
    rejectReason?: string | null;
  }) => void;
}

export interface ClientToServerEvents {
  'ping:server': () => void;
}

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:4000');

let socket: TypedSocket | null = null;

/**
 * Returns or creates the Socket.io client instance.
 */
export function getSocket(token?: string): TypedSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
    });
  } else if (token && socket.auth) {
    socket.auth = { token };
  }

  return socket;
}

/**
 * Connects the socket if not already connected.
 */
export function connectSocket(token?: string): TypedSocket {
  const s = getSocket(token);
  if (!s.connected) {
    s.connect();
  }
  return s;
}

/**
 * Disconnects the socket cleanly.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default getSocket;
