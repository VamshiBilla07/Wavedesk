import http from 'http';
import { AddressInfo } from 'net';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { initSocket, closeSocket, emitToCompany } from './socket';
import { Direction, MessageStatus, MessageType } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-min-32-characters-long';
process.env.JWT_SECRET = JWT_SECRET;

describe('Socket.io Realtime Service', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer();
    initSocket(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await closeSocket();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('rejects connection if no JWT token is supplied', async () => {
    await new Promise<void>((resolve, reject) => {
      const client = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        reconnection: false,
      });

      client.on('connect_error', (err) => {
        expect(err.message).toContain('Missing token');
        client.disconnect();
        resolve();
      });

      client.on('connect', () => {
        client.disconnect();
        reject(new Error('Should not have connected without token'));
      });
    });
  });

  it('rejects connection if an invalid token is provided', async () => {
    await new Promise<void>((resolve, reject) => {
      const client = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: 'invalid.jwt.token' },
        reconnection: false,
      });

      client.on('connect_error', (err) => {
        expect(err.message).toContain('Invalid or expired token');
        client.disconnect();
        resolve();
      });

      client.on('connect', () => {
        client.disconnect();
        reject(new Error('Should not have connected with invalid token'));
      });
    });
  });

  it('successfully authenticates and connects with valid JWT token', async () => {
    const validToken = jwt.sign(
      {
        id: 'u-123',
        email: 'agent@acme.com',
        role: 'AGENT',
        companyId: 'company-123',
      },
      JWT_SECRET
    );

    await new Promise<void>((resolve, reject) => {
      const client = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: validToken },
        reconnection: false,
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        resolve();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        reject(err);
      });
    });
  });

  it('broadcasts events strictly to the target company room using emitToCompany', async () => {
    const tokenA = jwt.sign(
      { id: 'u-a', email: 'a@co-a.com', role: 'AGENT', companyId: 'co-a' },
      JWT_SECRET
    );
    const tokenB = jwt.sign(
      { id: 'u-b', email: 'b@co-b.com', role: 'AGENT', companyId: 'co-b' },
      JWT_SECRET
    );

    let clientA: ClientSocket;
    let clientB: ClientSocket;

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        clientA = Client(`http://localhost:${port}`, {
          transports: ['websocket'],
          auth: { token: tokenA },
          reconnection: false,
        });
        clientA.on('connect', () => resolve());
        clientA.on('connect_error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        clientB = Client(`http://localhost:${port}`, {
          transports: ['websocket'],
          auth: { token: tokenB },
          reconnection: false,
        });
        clientB.on('connect', () => resolve());
        clientB.on('connect_error', reject);
      }),
    ]);

    const mockMessage = {
      id: 'msg-realtime-1',
      companyId: 'co-a',
      customerId: 'cust-1',
      waMessageId: 'wamid.123',
      direction: Direction.INBOUND,
      type: MessageType.TEXT,
      body: 'Realtime inbound message',
      templateName: null,
      mediaUrl: null,
      status: MessageStatus.DELIVERED,
      errorCode: null,
      errorMessage: null,
      sentAt: null,
      deliveredAt: new Date(),
      readAt: null,
      createdAt: new Date(),
    };

    const mockCustomer = {
      id: 'cust-1',
      companyId: 'co-a',
      phone: '1234567890',
      name: 'Alice',
      email: null,
      contactTypeId: null,
      attributes: null,
      optedOut: false,
      unreadCount: 1,
      lastMessageAt: new Date(),
      lastCustomerMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let clientAReceived = false;
    let clientBReceived = false;

    clientA!.on('message:new', (payload) => {
      expect(payload.message.id).toBe('msg-realtime-1');
      expect(payload.customer.name).toBe('Alice');
      clientAReceived = true;
    });

    clientB!.on('message:new', () => {
      clientBReceived = true;
    });

    // Emit event strictly for company 'co-a'
    emitToCompany('co-a', 'message:new', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      message: mockMessage as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customer: mockCustomer as any,
    });

    // Wait 250ms for message delivery
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(clientAReceived).toBe(true);
    expect(clientBReceived).toBe(false);

    clientA!.disconnect();
    clientB!.disconnect();
  });
});
