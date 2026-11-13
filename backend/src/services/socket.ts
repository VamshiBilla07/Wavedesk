import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { Message, Customer, MessageStatus, TemplateStatus, Role } from '@prisma/client';
import { redis } from './cache';

export interface ServerToClientEvents {
  'message:new': (payload: { message: Message; customer: Customer }) => void;
  'message:status': (payload: {
    messageId: string;
    waMessageId: string | null;
    status: MessageStatus;
    sentAt?: Date | null;
    deliveredAt?: Date | null;
    readAt?: Date | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }) => void;
  'customer:updated': (payload: { customer: Customer }) => void;
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
    status: TemplateStatus;
    rejectReason?: string | null;
  }) => void;
}

export interface ClientToServerEvents {
  'ping:server': () => void;
}

export interface SocketData {
  user: {
    id: string;
    email: string;
    role: Role;
    companyId: string;
  };
}

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> | null = null;

/**
 * Initializes Socket.io with JWT handshake auth and Redis adapter.
 */
export function initSocket(httpServer: http.Server): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((o) => o.trim()),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Attempt to attach Redis adapter for multi-instance scaling
  try {
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io?.adapter(createAdapter(pubClient, subClient));
        if (process.env.NODE_ENV !== 'test') {
          console.log('[Socket.io] Connected to Redis pub/sub adapter');
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[Socket.io] Redis adapter unavailable, using in-memory adapter:', err.message);
        }
      });
  } catch {
    // In-memory fallback
  }

  // Authentication handshake middleware
  io.use((socket: Socket, next) => {
    try {
      let token: string | undefined;

      // 1. Check handshake auth token
      if (socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
      }

      // 2. Check Authorization Bearer header
      if (!token && socket.handshake.headers.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
          token = parts[1];
        }
      }

      // 3. Check httpOnly cookie
      if (!token && socket.handshake.headers.cookie) {
        const parsedCookies = cookie.parse(socket.handshake.headers.cookie);
        token = parsedCookies.wavedesk_token || parsedCookies.token;
      }

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error('Internal error: Missing JWT_SECRET'));
      }

      const decoded = jwt.verify(token, secret) as SocketData['user'];
      if (!decoded.id || !decoded.companyId) {
        return next(new Error('Authentication error: Invalid token payload'));
      }

      socket.data.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        companyId: decoded.companyId,
      };

      next();
    } catch {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // Connection handling
  io.on('connection', (socket) => {
    const companyId = socket.data.user.companyId;
    const room = `company:${companyId}`;

    socket.join(room);

    socket.on('disconnect', () => {
      socket.leave(room);
    });
  });

  return io;
}

/**
 * Returns the active Socket.io instance
 */
export function getIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> | null {
  return io;
}

/**
 * Broadcasts a typed real-time event strictly to users within the company room.
 */
export function emitToCompany<K extends keyof ServerToClientEvents>(
  companyId: string,
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
): void {
  if (!io) return;
  const room = `company:${companyId}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (io.to(room) as any).emit(event, ...args);
}

/**
 * Cleanly closes the socket server.
 */
export function closeSocket(): Promise<void> {
  return new Promise((resolve) => {
    if (io) {
      io.close(() => {
        io = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export default {
  initSocket,
  getIO,
  emitToCompany,
  closeSocket,
};
