import crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import { Direction, MessageStatus, MessageType, CampaignStatus, TemplateStatus, Customer } from '@prisma/client';
import { prisma } from './database';
import { decrypt } from './encryption';
import { normalizePhone } from '../validation/common';
import { AppError } from '../middleware/errorHandler';
import { emitToCompany } from './socket';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export class MetaApiError extends AppError {
  public readonly fbtraceId?: string;

  constructor(message: string, statusCode = 400, code = 'META_API_ERROR', details?: unknown, fbtraceId?: string) {
    super(code, message, statusCode, details);
    this.name = 'MetaApiError';
    this.fbtraceId = fbtraceId;
  }
}

/**
 * Status priority ranking: PENDING < SENT < DELIVERED < READ
 */
export const STATUS_RANKS: Record<MessageStatus, number> = {
  [MessageStatus.PENDING]: 0,
  [MessageStatus.SENT]: 1,
  [MessageStatus.DELIVERED]: 2,
  [MessageStatus.READ]: 3,
  [MessageStatus.FAILED]: 99, // FAILED is always allowed
};

export function canTransitionStatus(
  currentStatus: MessageStatus,
  newStatus: MessageStatus
): boolean {
  if (newStatus === MessageStatus.FAILED) return true;
  if (currentStatus === MessageStatus.FAILED) return false;
  return STATUS_RANKS[newStatus] > STATUS_RANKS[currentStatus];
}

/**
 * Checks if the 24-hour customer messaging window is open.
 * The window opens when the customer sends an inbound message.
 */
export function is24HourWindowOpen(lastCustomerMessageAt: Date | null | undefined): boolean {
  if (!lastCustomerMessageAt) return false;
  const elapsedMs = Date.now() - new Date(lastCustomerMessageAt).getTime();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  return elapsedMs <= TWENTY_FOUR_HOURS_MS;
}

/**
 * Verifies HMAC-SHA256 signature from X-Hub-Signature-256 header using timingSafeEqual.
 */
export function verifySignature(
  rawBody: Buffer | string | undefined,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret || !rawBody) {
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedSignatureHex = parts[1];
  const hmac = crypto.createHmac('sha256', appSecret);
  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  hmac.update(bodyBuffer);
  const calculatedSignatureHex = hmac.digest('hex');

  const expectedBuffer = Buffer.from(expectedSignatureHex, 'utf8');
  const calculatedBuffer = Buffer.from(calculatedSignatureHex, 'utf8');

  if (expectedBuffer.length !== calculatedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
}

/**
 * Resolves decrypted credentials for a company.
 */
async function getCompanyCredentials(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      phoneNumberId: true,
      wabaId: true,
      encAccessToken: true,
      encAppSecret: true,
    },
  });

  if (!company) {
    throw new AppError('NOT_FOUND', 'Company not found', 404);
  }

  const isMock = process.env.WHATSAPP_MOCK === 'true';

  let accessToken: string | null = null;
  let appSecret: string | null = null;

  if (company.encAccessToken) {
    try {
      accessToken = decrypt(company.encAccessToken);
    } catch {
      accessToken = null;
    }
  }

  if (company.encAppSecret) {
    try {
      appSecret = decrypt(company.encAppSecret);
    } catch {
      appSecret = null;
    }
  }

  return {
    phoneNumberId: company.phoneNumberId,
    wabaId: company.wabaId,
    accessToken,
    appSecret,
    isMock: isMock || !accessToken || !company.phoneNumberId,
  };
}

/**
 * Sends a text message to a customer.
 */
export async function sendText(params: {
  companyId: string;
  toPhone: string;
  text: string;
}): Promise<{ waMessageId: string }> {
  const normalizedTo = normalizePhone(params.toPhone);
  const creds = await getCompanyCredentials(params.companyId);

  if (creds.isMock) {
    const mockWaMessageId = `wamid.mock.${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return { waMessageId: mockWaMessageId };
  }

  try {
    const url = `${GRAPH_BASE_URL}/${creds.phoneNumberId}/messages`;
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedTo,
        type: 'text',
        text: { body: params.text },
      },
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const waMessageId = response.data?.messages?.[0]?.id;
    if (!waMessageId) {
      throw new Error('No waMessageId returned from WhatsApp API');
    }

    return { waMessageId };
  } catch (err) {
    handleAxiosMetaError(err);
  }
}

/**
 * Sends a template message to a customer.
 */
export async function sendTemplate(params: {
  companyId: string;
  toPhone: string;
  templateName: string;
  language?: string;
  components?: unknown[];
}): Promise<{ waMessageId: string }> {
  const normalizedTo = normalizePhone(params.toPhone);
  const creds = await getCompanyCredentials(params.companyId);

  if (creds.isMock) {
    const mockWaMessageId = `wamid.mock.${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return { waMessageId: mockWaMessageId };
  }

  try {
    const url = `${GRAPH_BASE_URL}/${creds.phoneNumberId}/messages`;
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedTo,
        type: 'template',
        template: {
          name: params.templateName,
          language: { code: params.language || 'en_US' },
          components: params.components || [],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const waMessageId = response.data?.messages?.[0]?.id;
    if (!waMessageId) {
      throw new Error('No waMessageId returned from WhatsApp API');
    }

    return { waMessageId };
  } catch (err) {
    handleAxiosMetaError(err);
  }
}

/**
 * Sends a media message (image, document, audio, video).
 */
export async function sendMedia(params: {
  companyId: string;
  toPhone: string;
  type: 'image' | 'document' | 'audio' | 'video';
  mediaUrl: string;
  caption?: string;
}): Promise<{ waMessageId: string }> {
  const normalizedTo = normalizePhone(params.toPhone);
  const creds = await getCompanyCredentials(params.companyId);

  if (creds.isMock) {
    const mockWaMessageId = `wamid.mock.${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return { waMessageId: mockWaMessageId };
  }

  try {
    const url = `${GRAPH_BASE_URL}/${creds.phoneNumberId}/messages`;
    const mediaPayload: Record<string, string> = { link: params.mediaUrl };
    if (params.caption && (params.type === 'image' || params.type === 'document' || params.type === 'video')) {
      mediaPayload.caption = params.caption;
    }

    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedTo,
        type: params.type,
        [params.type]: mediaPayload,
      },
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const waMessageId = response.data?.messages?.[0]?.id;
    return { waMessageId };
  } catch (err) {
    handleAxiosMetaError(err);
  }
}

/**
 * Marks a message as read in WhatsApp Cloud API.
 */
export async function markAsRead(params: {
  companyId: string;
  waMessageId: string;
}): Promise<void> {
  const creds = await getCompanyCredentials(params.companyId);
  if (creds.isMock) return;

  try {
    const url = `${GRAPH_BASE_URL}/${creds.phoneNumberId}/messages`;
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: params.waMessageId,
      },
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );
  } catch {
    // Non-fatal if mark-as-read fails
  }
}

/**
 * Tests WhatsApp credentials against Meta Graph API.
 */
export async function verifyCredentials(
  phoneNumberId: string,
  accessToken: string
): Promise<{ success: boolean; phoneName?: string; verifiedNumber?: string }> {
  if (process.env.WHATSAPP_MOCK === 'true') {
    return {
      success: true,
      phoneName: 'Wavedesk Mock WhatsApp Business Number',
      verifiedNumber: '+1 555 123 4567',
    };
  }

  try {
    const url = `${GRAPH_BASE_URL}/${phoneNumberId}`;
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });
    return {
      success: true,
      phoneName: res.data?.verified_name || res.data?.display_phone_number,
      verifiedNumber: res.data?.display_phone_number,
    };
  } catch (err) {
    handleAxiosMetaError(err);
  }
}

/**
 * Creates a message template on Meta WhatsApp Business Account.
 */
export async function createTemplate(params: {
  companyId: string;
  name: string;
  category: string;
  language: string;
  components: unknown[];
}): Promise<{ id: string; status: string }> {
  const creds = await getCompanyCredentials(params.companyId);
  if (creds.isMock) {
    return { id: `mock_tpl_${Date.now()}`, status: 'APPROVED' };
  }

  try {
    const url = `${GRAPH_BASE_URL}/${creds.wabaId}/message_templates`;
    const res = await axios.post(
      url,
      {
        name: params.name,
        category: params.category,
        language: params.language,
        components: params.components,
      },
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    return { id: res.data.id, status: res.data.status || 'PENDING' };
  } catch (err) {
    handleAxiosMetaError(err);
  }
}

/**
 * Lists templates from Meta WhatsApp Business Account.
 */
export async function listTemplates(companyId: string): Promise<unknown[]> {
  const creds = await getCompanyCredentials(companyId);
  if (creds.isMock) {
    return [];
  }

  try {
    const url = `${GRAPH_BASE_URL}/${creds.wabaId}/message_templates`;
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
      timeout: 10000,
    });
    return res.data?.data || [];
  } catch (err) {
    handleAxiosMetaError(err);
  }
}

/**
 * Maps Meta Graph API error codes into typed MetaApiError.
 */
function handleAxiosMetaError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<{
      error?: {
        message?: string;
        code?: number;
        error_subcode?: number;
        fbtrace_id?: string;
      };
    }>;
    const metaError = axiosErr.response?.data?.error;
    const message = metaError?.message || axiosErr.message || 'WhatsApp Cloud API call failed';
    const code = metaError?.code;
    const fbtraceId = metaError?.fbtrace_id;

    // Map common Meta codes
    let appErrorCode = 'META_API_ERROR';
    if (code === 190) appErrorCode = 'TOKEN_EXPIRED';
    else if (code === 131030) appErrorCode = 'INVALID_PHONE_NUMBER';
    else if (code === 130429) appErrorCode = 'RATE_LIMIT_EXCEEDED';
    else if (code === 132000) appErrorCode = 'TEMPLATE_NOT_APPROVED';
    else if (code === 131047) appErrorCode = 'WINDOW_CLOSED';

    throw new MetaApiError(message, axiosErr.response?.status || 502, appErrorCode, metaError, fbtraceId);
  }
  throw err;
}

/**
 * Inbound webhook processing:
 * - Upserts customer
 * - Sets lastCustomerMessageAt (opens 24-hour window)
 * - Idempotently creates inbound message
 * - Updates status events respecting hierarchy
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function processWebhook(payload: any): Promise<void> {
  if (!payload || !payload.entry) return;

  for (const entry of payload.entry) {
    for (const change of entry.changes || []) {
      // 1. Template Status Updates from Meta
      if (change.field === 'message_template_status_update') {
        const val = change.value;
        if (!val) continue;

        const wabaId = entry.id;
        let company = wabaId ? await prisma.company.findFirst({ where: { wabaId } }) : null;
        if (!company) {
          company = await prisma.company.findFirst();
        }
        if (!company) continue;

        const templateName = val.message_template_name;
        const templateLanguage = val.message_template_language || 'en_US';
        const rawStatus = (val.event || val.status || '').toUpperCase();
        let targetStatus: TemplateStatus = TemplateStatus.PENDING;
        if (rawStatus === 'APPROVED') targetStatus = TemplateStatus.APPROVED;
        else if (rawStatus === 'REJECTED') targetStatus = TemplateStatus.REJECTED;
        else if (rawStatus === 'PAUSED') targetStatus = TemplateStatus.PAUSED;

        const updated = await prisma.template.updateMany({
          where: {
            companyId: company.id,
            name: templateName,
            language: templateLanguage,
          },
          data: {
            status: targetStatus,
            rejectReason: val.reason || null,
          },
        });

        if (updated.count > 0) {
          const tpl = await prisma.template.findFirst({
            where: {
              companyId: company.id,
              name: templateName,
              language: templateLanguage,
            },
          });
          if (tpl) {
            emitToCompany(company.id, 'template:status', {
              templateId: tpl.id,
              status: tpl.status,
              rejectReason: tpl.rejectReason,
            });
          }
        }
        continue;
      }

      if (change.field !== 'messages') continue;
      const value = change.value;
      if (!value) continue;

      const phoneNumberId = value.metadata?.phone_number_id;

      // Resolve company by phoneNumberId
      let company = phoneNumberId
        ? await prisma.company.findFirst({
            where: { phoneNumberId },
          })
        : null;

      // If in mock or development mode and phoneNumberId not bound, fallback to first company
      if (!company) {
        company = await prisma.company.findFirst();
      }

      if (!company) {
        console.warn('[Webhook] No company found to handle event for phone_number_id:', phoneNumberId);
        continue;
      }

      const companyId = company.id;

      // 2. Handle Inbound Messages
      for (const msg of value.messages || []) {
        await processInboundMessage(companyId, msg, value.contacts);
      }

      // 3. Handle Status Updates (sent, delivered, read, failed)
      for (const status of value.statuses || []) {
        await processStatusUpdate(companyId, status);
      }
    }
  }
}

/**
 * Inbound customer message processing:
 * - Normalizes phone
 * - Upserts customer by (companyId, phone)
 * - Opens 24-hour window: sets lastCustomerMessageAt
 * - Inserts Message with unique waMessageId, ignoring duplicate conflict (idempotency)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processInboundMessage(companyId: string, msg: any, contacts: any[] = []): Promise<void> {
  const waMessageId = msg.id;
  const fromPhone = normalizePhone(msg.from);
  const now = new Date();

  // Find customer name from WhatsApp contacts payload if available
  const contact = contacts.find((c) => normalizePhone(c.wa_id) === fromPhone);
  const profileName = contact?.profile?.name;

  // Upsert Customer
  const customer = await prisma.customer.upsert({
    where: {
      companyId_phone: {
        companyId,
        phone: fromPhone,
      },
    },
    update: {
      lastCustomerMessageAt: now,
      lastMessageAt: now,
      unreadCount: { increment: 1 },
      ...(profileName ? { name: profileName } : {}),
    },
    create: {
      companyId,
      phone: fromPhone,
      name: profileName || null,
      lastCustomerMessageAt: now,
      lastMessageAt: now,
      unreadCount: 1,
    },
  });

  // Extract body and message type
  let type: MessageType = MessageType.TEXT;
  let body: string | null = null;
  let mediaUrl: string | null = null;

  if (msg.type === 'text') {
    type = MessageType.TEXT;
    body = msg.text?.body || '';
  } else if (msg.type === 'image') {
    type = MessageType.IMAGE;
    body = msg.image?.caption || null;
    mediaUrl = msg.image?.id || null;
  } else if (msg.type === 'document') {
    type = MessageType.DOCUMENT;
    body = msg.document?.caption || msg.document?.filename || null;
    mediaUrl = msg.document?.id || null;
  } else if (msg.type === 'audio') {
    type = MessageType.AUDIO;
    mediaUrl = msg.audio?.id || null;
  } else if (msg.type === 'video') {
    type = MessageType.VIDEO;
    body = msg.video?.caption || null;
    mediaUrl = msg.video?.id || null;
  } else {
    type = MessageType.OTHER;
    body = JSON.stringify(msg[msg.type] || {});
  }

  // Idempotent insertion: ignore P2002 if waMessageId already recorded
  try {
    const createdMessage = await prisma.message.create({
      data: {
        companyId,
        customerId: customer.id,
        waMessageId,
        direction: Direction.INBOUND,
        type,
        body,
        mediaUrl,
        status: MessageStatus.DELIVERED,
        deliveredAt: now,
      },
    });

    emitToCompany(companyId, 'message:new', { message: createdMessage, customer });
    emitToCompany(companyId, 'customer:updated', { customer });
  } catch (err) {
    // Unique constraint violation on waMessageId means this event was already processed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((err as any).code === 'P2002') {
      return;
    }
    throw err;
  }
}

/**
 * Status update processing with ranking rules:
 * PENDING < SENT < DELIVERED < READ. FAILED allowed anytime.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processStatusUpdate(companyId: string, statusObj: any): Promise<void> {
  const waMessageId = statusObj.id;
  const rawStatus = (statusObj.status || '').toUpperCase();
  const timestamp = statusObj.timestamp ? new Date(parseInt(statusObj.timestamp, 10) * 1000) : new Date();

  let targetStatus: MessageStatus | null = null;
  if (rawStatus === 'SENT') targetStatus = MessageStatus.SENT;
  else if (rawStatus === 'DELIVERED') targetStatus = MessageStatus.DELIVERED;
  else if (rawStatus === 'READ') targetStatus = MessageStatus.READ;
  else if (rawStatus === 'FAILED') targetStatus = MessageStatus.FAILED;

  if (!targetStatus) return;

  const message = await prisma.message.findFirst({
    where: { companyId, waMessageId },
  });

  if (!message) {
    // Status arrived before message record or message belongs to another company
    return;
  }

  // Enforce status ranking: never downgrade
  if (!canTransitionStatus(message.status, targetStatus)) {
    return;
  }

  const updateData: {
    status: MessageStatus;
    sentAt?: Date;
    deliveredAt?: Date;
    readAt?: Date;
    errorCode?: string;
    errorMessage?: string;
  } = {
    status: targetStatus,
  };

  if (targetStatus === MessageStatus.SENT && !message.sentAt) {
    updateData.sentAt = timestamp;
  } else if (targetStatus === MessageStatus.DELIVERED && !message.deliveredAt) {
    updateData.deliveredAt = timestamp;
  } else if (targetStatus === MessageStatus.READ && !message.readAt) {
    updateData.readAt = timestamp;
  } else if (targetStatus === MessageStatus.FAILED) {
    const errorDetails = statusObj.errors?.[0];
    updateData.errorCode = errorDetails?.code?.toString() || 'FAILED';
    updateData.errorMessage = errorDetails?.title || errorDetails?.message || 'Message delivery failed';
  }

  await prisma.message.update({
    where: { id: message.id },
    data: updateData,
  });

  // Also update linked campaign recipient if exists
  await prisma.campaignRecipient.updateMany({
    where: { waMessageId },
    data: updateData,
  });

  emitToCompany(companyId, 'message:status', {
    messageId: message.id,
    waMessageId,
    status: targetStatus,
    sentAt: updateData.sentAt || message.sentAt,
    deliveredAt: updateData.deliveredAt || message.deliveredAt,
    readAt: updateData.readAt || message.readAt,
    errorCode: updateData.errorCode,
    errorMessage: updateData.errorMessage,
  });
}

/**
 * Formats template dynamic parameters for WhatsApp Cloud API.
 */
function buildTemplateComponents(
  variableMap: Record<string, string> | null | undefined,
  customer: Customer
): Array<{ type: string; parameters: Array<{ type: string; text: string }> }> | undefined {
  if (!variableMap || Object.keys(variableMap).length === 0) {
    return undefined;
  }

  const sortedKeys = Object.keys(variableMap).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  const parameters = sortedKeys.map((key) => {
    const fieldOrVal = variableMap[key];
    let resolved = '';

    if (fieldOrVal === 'name') {
      resolved = customer.name || 'there';
    } else if (fieldOrVal === 'phone') {
      resolved = customer.phone;
    } else if (fieldOrVal === 'email') {
      resolved = customer.email || '';
    } else {
      const attrs = (customer.attributes as Record<string, unknown> | null) || {};
      if (attrs[fieldOrVal] !== undefined) {
        resolved = String(attrs[fieldOrVal]);
      } else {
        resolved = fieldOrVal;
      }
    }

    return { type: 'text', text: resolved };
  });

  return [
    {
      type: 'body',
      parameters,
    },
  ];
}

/**
 * Emits live campaign progress metrics to the company socket room.
 */
async function emitCampaignProgress(companyId: string, campaignId: string): Promise<void> {
  const counts = await prisma.campaignRecipient.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: { status: true },
  });

  let sent = 0;
  let delivered = 0;
  let read = 0;
  let failed = 0;

  for (const c of counts) {
    if (c.status === MessageStatus.SENT) sent = c._count.status;
    else if (c.status === MessageStatus.DELIVERED) delivered = c._count.status;
    else if (c.status === MessageStatus.READ) read = c._count.status;
    else if (c.status === MessageStatus.FAILED) failed = c._count.status;
  }

  const total = await prisma.campaignRecipient.count({ where: { campaignId } });

  emitToCompany(companyId, 'campaign:progress', {
    campaignId,
    sent: sent + delivered + read,
    delivered: delivered + read,
    read,
    failed,
    total,
  });
}

/**
 * Resumable, rate-limited background sender loop for a campaign.
 */
export async function runCampaign(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  });

  if (!campaign || campaign.status !== CampaignStatus.RUNNING) {
    return;
  }

  const ratePerSec = parseInt(process.env.CAMPAIGN_RATE_PER_SEC || '20', 10) || 20;
  const delayMs = Math.max(Math.floor(1000 / ratePerSec), 10);

  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: MessageStatus.PENDING },
    include: { customer: true },
    orderBy: { id: 'asc' },
  });

  const variableMap = (campaign.variableMap as Record<string, string> | null) || null;

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];

    // Check campaign status before sending each message (supports live pause / cancel)
    const checkCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });

    if (!checkCampaign || checkCampaign.status !== CampaignStatus.RUNNING) {
      break;
    }

    if (recipient.customer.optedOut) {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: MessageStatus.FAILED,
          errorCode: 'OPTED_OUT',
          errorMessage: 'Customer has opted out of messaging',
          attempts: { increment: 1 },
        },
      });
      continue;
    }

    try {
      const components = buildTemplateComponents(variableMap, recipient.customer);

      const sendResult = await sendTemplate({
        companyId: campaign.companyId,
        toPhone: recipient.customer.phone,
        templateName: campaign.template.name,
        language: campaign.template.language,
        components,
      });

      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          waMessageId: sendResult.waMessageId,
          status: MessageStatus.SENT,
          sentAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      await prisma.message.create({
        data: {
          companyId: campaign.companyId,
          customerId: recipient.customerId,
          waMessageId: sendResult.waMessageId,
          direction: Direction.OUTBOUND,
          type: MessageType.TEMPLATE,
          templateName: campaign.template.name,
          body: `Template: ${campaign.template.name}`,
          status: MessageStatus.SENT,
          sentAt: new Date(),
        },
      });

      await prisma.customer.update({
        where: { id: recipient.customerId },
        data: { lastMessageAt: new Date() },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Campaign dispatch failed';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorCode = (err as any)?.code || 'SEND_FAILED';

      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: MessageStatus.FAILED,
          errorCode,
          errorMessage,
          attempts: { increment: 1 },
        },
      });
    }

    // Rate-limiting throttle
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Emit live progress periodically
    if (i % 5 === 0 || i === recipients.length - 1) {
      await emitCampaignProgress(campaign.companyId, campaignId);
    }
  }

  // Check completion
  const remainingPending = await prisma.campaignRecipient.count({
    where: { campaignId, status: MessageStatus.PENDING },
  });

  const checkStatus = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });

  if (remainingPending === 0 && checkStatus?.status === CampaignStatus.RUNNING) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  await emitCampaignProgress(campaign.companyId, campaignId);
}

/**
 * Resumes campaigns in RUNNING state upon server boot.
 */
export async function resumeRunningCampaigns(): Promise<void> {
  try {
    const running = await prisma.campaign.findMany({
      where: { status: CampaignStatus.RUNNING },
      select: { id: true },
    });

    for (const c of running) {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[Campaigns] Resuming background campaign ${c.id}`);
      }
      setImmediate(() => {
        runCampaign(c.id).catch((err) => {
          console.error(`[Campaigns] Error resuming campaign ${c.id}:`, err);
        });
      });
    }
  } catch (err) {
    console.error('[Campaigns] Failed to resume campaigns on startup:', err);
  }
}

export default {
  sendText,
  sendTemplate,
  sendMedia,
  markAsRead,
  verifyCredentials,
  verifySignature,
  processWebhook,
  runCampaign,
  resumeRunningCampaigns,
  is24HourWindowOpen,
  canTransitionStatus,
};
