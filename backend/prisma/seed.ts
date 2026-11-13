import {
  PrismaClient,
  Role,
  TemplateCategory,
  TemplateStatus,
  CampaignStatus,
  Direction,
  MessageType,
  MessageStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { encrypt } from '../src/services/encryption';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Wavedesk demo showcase database...');

  const COMPANY_ID = 'demo-company-wavedesk';

  // 1. Create or update Showcase Demo Company
  const company = await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {
      name: 'Wavedesk Technologies Inc.',
    },
    create: {
      id: COMPANY_ID,
      name: 'Wavedesk Technologies Inc.',
      phoneNumberId: '109876543210987',
      wabaId: '123456789012345',
      encAccessToken: encrypt('mock_access_token_demo_123456789'),
      encAppSecret: encrypt(process.env.META_APP_SECRET || 'mock_app_secret'),
      verifyToken: process.env.META_VERIFY_TOKEN || 'wavedesk_verify_token_123',
    },
  });

  console.log(`? Company ready: ${company.name} (${company.id})`);

  // 2. Create Demo Showcase User & Admin User
  const demoPasswordHash = await bcrypt.hash('Demo@2026!', 10);
  const adminPasswordHash = await bcrypt.hash('Password123!', 10);

  // Primary Recruiter & Showcase Demo Account
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@wavedesk.io' },
    update: { passwordHash: demoPasswordHash, name: 'Vamshi Billa (Founder & Admin)' },
    create: {
      companyId: company.id,
      name: 'Vamshi Billa (Founder & Admin)',
      email: 'demo@wavedesk.io',
      passwordHash: demoPasswordHash,
      role: Role.OWNER,
    },
  });

  // Backward-compatible Admin account
  await prisma.user.upsert({
    where: { email: 'admin@wavedesk.io' },
    update: { passwordHash: adminPasswordHash },
    create: {
      companyId: company.id,
      name: 'Wavedesk Administrator',
      email: 'admin@wavedesk.io',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  console.log(`? Demo user ready: ${demoUser.email} (Password: Demo@2026!)`);
  console.log(`? Admin user ready: admin@wavedesk.io (Password: Password123!)`);

  // 3. Create Contact Types with Modern Brand Colors
  const enterpriseType = await prisma.contactType.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Enterprise Client' } },
    update: {},
    create: { companyId: company.id, name: 'Enterprise Client', color: '#8B5CF6' },
  });

  const vipType = await prisma.contactType.upsert({
    where: { companyId_name: { companyId: company.id, name: 'VIP Customer' } },
    update: {},
    create: { companyId: company.id, name: 'VIP Customer', color: '#10B981' },
  });

  const leadType = await prisma.contactType.upsert({
    where: { companyId_name: { companyId: company.id, name: 'High-Value Lead' } },
    update: {},
    create: { companyId: company.id, name: 'High-Value Lead', color: '#3B82F6' },
  });

  const partnerType = await prisma.contactType.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Strategic Partner' } },
    update: {},
    create: { companyId: company.id, name: 'Strategic Partner', color: '#F59E0B' },
  });

  // 4. Create Tags
  const vipTag = await prisma.tag.upsert({
    where: { companyId_name: { companyId: company.id, name: 'VIP Tier' } },
    update: {},
    create: { companyId: company.id, name: 'VIP Tier', color: '#10B981' },
  });

  const hotLeadTag = await prisma.tag.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Hot Lead' } },
    update: {},
    create: { companyId: company.id, name: 'Hot Lead', color: '#EF4444' },
  });

  const enterpriseTag = await prisma.tag.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Enterprise SLA' } },
    update: {},
    create: { companyId: company.id, name: 'Enterprise SLA', color: '#8B5CF6' },
  });

  const windowTag = await prisma.tag.upsert({
    where: { companyId_name: { companyId: company.id, name: '24h Active' } },
    update: {},
    create: { companyId: company.id, name: '24h Active', color: '#06B6D4' },
  });

  const onboardingTag = await prisma.tag.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Onboarding' } },
    update: {},
    create: { companyId: company.id, name: 'Onboarding', color: '#3B82F6' },
  });

  const highVolumeTag = await prisma.tag.upsert({
    where: { companyId_name: { companyId: company.id, name: 'High Volume' } },
    update: {},
    create: { companyId: company.id, name: 'High Volume', color: '#F59E0B' },
  });

  // 5. Create 10 Showcase Realistic Customers
  const customerData = [
    {
      phone: '15559876543',
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@techcorp.io',
      contactTypeId: enterpriseType.id,
      tagIds: [vipTag.id, enterpriseTag.id, windowTag.id],
      attributes: { company: 'TechCorp Solutions', plan: 'Enterprise', arr: '$45,000' },
      hoursAgo: 1, // Within 24-hr messaging window
    },
    {
      phone: '15551234567',
      name: 'Alex Rivera',
      email: 'alex@riverafashion.com',
      contactTypeId: leadType.id,
      tagIds: [hotLeadTag.id, windowTag.id],
      attributes: { store: 'Rivera Fashion NYC', monthlyOrders: '3,200' },
      hoursAgo: 2, // Within 24-hr messaging window
    },
    {
      phone: '15553456789',
      name: 'Emily Rodriguez',
      email: 'emily.r@servicepro.net',
      contactTypeId: enterpriseType.id,
      tagIds: [enterpriseTag.id, windowTag.id],
      attributes: { company: 'ServicePro Global', seatCount: '120' },
      hoursAgo: 4, // Within 24-hr messaging window
    },
    {
      phone: '15557890123',
      name: 'David Kim',
      email: 'david@cloudscale.ai',
      contactTypeId: vipType.id,
      tagIds: [vipTag.id, highVolumeTag.id],
      attributes: { company: 'CloudScale AI', cloudProvider: 'GCP' },
      hoursAgo: 18, // Within 24-hr messaging window
    },
    {
      phone: '15554567890',
      name: 'Priya Sharma',
      email: 'priya@nexagrowth.com',
      contactTypeId: leadType.id,
      tagIds: [hotLeadTag.id, onboardingTag.id],
      attributes: { agency: 'Nexa Growth Media', budget: '$12,000/mo' },
      hoursAgo: 22,
    },
    {
      phone: '15552345678',
      name: 'Marcus Thorne',
      email: 'marcus.t@apexlogistics.com',
      contactTypeId: partnerType.id,
      tagIds: [enterpriseTag.id, highVolumeTag.id],
      attributes: { fleetSize: '450 trucks', region: 'North America' },
      hoursAgo: 36, // Outside 24-hr window (demonstrates template requirement!)
    },
    {
      phone: '15556789012',
      name: 'Chloe Bennett',
      email: 'chloe@horizonhealth.org',
      contactTypeId: vipType.id,
      tagIds: [vipTag.id],
      attributes: { clinicCount: '18 locations', patientVolume: 'High' },
      hoursAgo: 48,
    },
    {
      phone: '15558901234',
      name: 'Jordan Lee',
      email: 'jordan@swiftcourier.co',
      contactTypeId: leadType.id,
      tagIds: [highVolumeTag.id, windowTag.id],
      attributes: { parcelVolume: '85,000/mo' },
      hoursAgo: 3,
    },
    {
      phone: '15559012345',
      name: 'Hannah Vance',
      email: 'hannah@bloombotanicals.com',
      contactTypeId: vipType.id,
      tagIds: [onboardingTag.id],
      attributes: { ecommercePlatform: 'Shopify Plus' },
      hoursAgo: 72,
    },
    {
      phone: '15550123456',
      name: 'Carlos Mendoza',
      email: 'carlos@urbanedgeretail.com',
      contactTypeId: partnerType.id,
      tagIds: [vipTag.id, enterpriseTag.id],
      attributes: { retailStores: '34' },
      hoursAgo: 96,
    },
  ];

  const customers: any[] = [];
  for (const c of customerData) {
    const lastActive = new Date(Date.now() - c.hoursAgo * 3600 * 1000);
    const customer = await prisma.customer.upsert({
      where: { companyId_phone: { companyId: company.id, phone: c.phone } },
      update: {
        name: c.name,
        email: c.email,
        contactTypeId: c.contactTypeId,
        attributes: c.attributes,
        lastCustomerMessageAt: lastActive,
        lastMessageAt: lastActive,
      },
      create: {
        companyId: company.id,
        phone: c.phone,
        name: c.name,
        email: c.email,
        contactTypeId: c.contactTypeId,
        attributes: c.attributes,
        lastCustomerMessageAt: lastActive,
        lastMessageAt: lastActive,
        tags: { connect: c.tagIds.map((id) => ({ id })) },
      },
    });
    customers.push(customer);
  }

  console.log(`? ${customers.length} showcase customers created with 24-hr window statuses.`);

  // 6. Create 5 Pre-Approved Meta WhatsApp Templates
  const templates = [
    {
      name: 'welcome_offer',
      language: 'en_US',
      category: TemplateCategory.MARKETING,
      components: [
        { type: 'HEADER', format: 'TEXT', text: 'Welcome to Wavedesk Enterprise!' },
        { type: 'BODY', text: 'Hi {{1}}, welcome! Use promotional code {{2}} to activate your 20% tier discount.' },
        { type: 'FOOTER', text: 'Reply STOP to opt out' },
      ],
    },
    {
      name: 'appointment_reminder',
      language: 'en_US',
      category: TemplateCategory.UTILITY,
      components: [
        { type: 'BODY', text: 'Hello {{1}}, this is a reminder for your upcoming executive consultation on {{2}}.' },
        { type: 'FOOTER', text: 'Wavedesk VIP Support' },
      ],
    },
    {
      name: 'order_confirmation',
      language: 'en_US',
      category: TemplateCategory.UTILITY,
      components: [
        { type: 'HEADER', format: 'TEXT', text: 'Order Confirmation #{{1}}' },
        { type: 'BODY', text: 'Hi {{1}}, thank you for your order! Your payment for {{2}} items has been confirmed and is being processed.' },
        { type: 'FOOTER', text: 'Questions? Reply directly to this chat.' },
      ],
    },
    {
      name: 'shipping_update',
      language: 'en_US',
      category: TemplateCategory.UTILITY,
      components: [
        { type: 'BODY', text: 'Great news {{1}}! Your package {{2}} is out for delivery today via express courier.' },
        { type: 'FOOTER', text: 'Real-time courier dispatch' },
      ],
    },
    {
      name: 'vip_seasonal_sale',
      language: 'en_US',
      category: TemplateCategory.MARKETING,
      components: [
        { type: 'HEADER', format: 'TEXT', text: 'Exclusive Early Access' },
        { type: 'BODY', text: 'Hello {{1}}, as a valued VIP client, your exclusive early access code {{2}} is live for the next 48 hours.' },
        { type: 'FOOTER', text: 'VIP Tier Benefits' },
      ],
    },
  ];

  const createdTemplates: any[] = [];
  for (const t of templates) {
    const tpl = await prisma.template.upsert({
      where: {
        companyId_name_language: {
          companyId: company.id,
          name: t.name,
          language: t.language,
        },
      },
      update: { components: t.components },
      create: {
        companyId: company.id,
        name: t.name,
        language: t.language,
        category: t.category,
        status: TemplateStatus.APPROVED,
        metaId: `meta_${t.name}_${Date.now()}`,
        components: t.components,
      },
    });
    createdTemplates.push(tpl);
  }

  console.log(`? ${createdTemplates.length} approved WhatsApp templates created.`);

  // 7. Seed Multi-Turn Conversations in the Shared Inbox
  await prisma.message.deleteMany({ where: { companyId: company.id } });

  const messagesToInsert: any[] = [];

  // Conversation with Sarah Jenkins (TechCorp)
  const sarah = customers.find((c) => c.phone === '15559876543');
  if (sarah) {
    messagesToInsert.push(
      {
        companyId: company.id,
        customerId: sarah.id,
        direction: Direction.INBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        body: 'Hello Vamshi, our TechCorp engineering team is evaluating Wavedesk for our customer support line.',
        createdAt: new Date(Date.now() - 1000 * 60 * 180), // 3 hours ago
      },
      {
        companyId: company.id,
        customerId: sarah.id,
        direction: Direction.OUTBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        body: 'Hi Sarah! Welcome to Wavedesk. We would be thrilled to support TechCorp. How many monthly active conversations are you anticipating?',
        createdAt: new Date(Date.now() - 1000 * 60 * 160),
      },
      {
        companyId: company.id,
        customerId: sarah.id,
        direction: Direction.INBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        body: 'We handle roughly 80,000 inbound tickets monthly. Does Wavedesk support automated rate limiting and multi-agent routing?',
        createdAt: new Date(Date.now() - 1000 * 60 * 120),
      },
      {
        companyId: company.id,
        customerId: sarah.id,
        direction: Direction.OUTBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        body: 'Yes, absolutely! Wavedesk features Redis-backed rate limiting, multi-tenant isolation, and a resumable background campaign engine at 20+ messages/sec.',
        createdAt: new Date(Date.now() - 1000 * 60 * 90),
      },
      {
        companyId: company.id,
        customerId: sarah.id,
        direction: Direction.INBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.DELIVERED,
        body: 'That is fantastic. Could you send over the onboarding agreement?',
        createdAt: new Date(Date.now() - 1000 * 60 * 30),
      },
      {
        companyId: company.id,
        customerId: sarah.id,
        direction: Direction.OUTBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.DELIVERED,
        body: 'Just sent to sarah.jenkins@techcorp.io! Let me know if you have any questions.',
        createdAt: new Date(Date.now() - 1000 * 60 * 15),
      }
    );
  }

  // Conversation with Alex Rivera (Rivera Fashion Store)
  const alex = customers.find((c) => c.phone === '15551234567');
  if (alex) {
    messagesToInsert.push(
      {
        companyId: company.id,
        customerId: alex.id,
        direction: Direction.INBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        body: 'Hi! I received the promotional SMS and want to order 500 units for our upcoming spring collection.',
        createdAt: new Date(Date.now() - 1000 * 60 * 240),
      },
      {
        companyId: company.id,
        customerId: alex.id,
        direction: Direction.OUTBOUND,
        type: MessageType.TEMPLATE,
        templateName: 'welcome_offer',
        status: MessageStatus.READ,
        body: 'Hi Alex, welcome! Use promotional code VIP20 to activate your 20% tier discount.',
        createdAt: new Date(Date.now() - 1000 * 60 * 210),
      },
      {
        companyId: company.id,
        customerId: alex.id,
        direction: Direction.INBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        body: 'Applied the code, payment went through smoothly. Thank you!',
        createdAt: new Date(Date.now() - 1000 * 60 * 95),
      },
      {
        companyId: company.id,
        customerId: alex.id,
        direction: Direction.OUTBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        body: 'Confirmed! Your order is being prepared for fulfillment in our warehouse.',
        createdAt: new Date(Date.now() - 1000 * 60 * 80),
      }
    );
  }

  // Conversation with Emily Rodriguez (ServicePro)
  const emily = customers.find((c) => c.phone === '15553456789');
  if (emily) {
    messagesToInsert.push(
      {
        companyId: company.id,
        customerId: emily.id,
        direction: Direction.INBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        body: 'Hey team, can we schedule our quarterly review for tomorrow at 2 PM EST?',
        createdAt: new Date(Date.now() - 1000 * 60 * 300),
      },
      {
        companyId: company.id,
        customerId: emily.id,
        direction: Direction.OUTBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        body: 'Hi Emily! 2 PM EST is locked in on our calendar. Looking forward to our review.',
        createdAt: new Date(Date.now() - 1000 * 60 * 280),
      }
    );
  }

  // Conversation with David Kim (CloudScale AI)
  const david = customers.find((c) => c.phone === '15557890123');
  if (david) {
    messagesToInsert.push(
      {
        companyId: company.id,
        customerId: david.id,
        direction: Direction.INBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        body: 'Checking in on the webhook latency benchmarks. The real-time updates look instantaneous on our test dashboard.',
        createdAt: new Date(Date.now() - 1000 * 60 * 420),
      },
      {
        companyId: company.id,
        customerId: david.id,
        direction: Direction.OUTBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        body: 'Glad to hear David! Our Socket.io Redis adapter delivers sub-50ms message broadcasting.',
        createdAt: new Date(Date.now() - 1000 * 60 * 400),
      }
    );
  }

  // 14 Days of Chronological Messages for Rich Analytics Timeseries
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const baseDate = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
    const outboundCount = 15 + Math.floor(Math.sin(daysAgo) * 6 + Math.random() * 8);
    const inboundCount = 10 + Math.floor(Math.cos(daysAgo) * 4 + Math.random() * 5);

    // Random customer for analytics
    for (let i = 0; i < outboundCount; i++) {
      const cust = customers[i % customers.length];
      messagesToInsert.push({
        companyId: company.id,
        customerId: cust.id,
        direction: Direction.OUTBOUND,
        type: MessageType.TEXT,
        status: i % 15 === 0 ? MessageStatus.FAILED : (i % 3 === 0 ? MessageStatus.READ : MessageStatus.DELIVERED),
        body: `Automated notification and campaign dispatch #${daysAgo}-${i}`,
        createdAt: new Date(baseDate.getTime() + (i * 3600 * 1000) / 2),
      });
    }

    for (let j = 0; j < inboundCount; j++) {
      const cust = customers[j % customers.length];
      messagesToInsert.push({
        companyId: company.id,
        customerId: cust.id,
        direction: Direction.INBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        body: `Customer inbound reply #${daysAgo}-${j}`,
        createdAt: new Date(baseDate.getTime() + (j * 3600 * 1000) / 2 + 1800 * 1000),
      });
    }
  }

  // Insert all messages
  for (const msg of messagesToInsert) {
    await prisma.message.create({
      data: {
        ...msg,
        waMessageId: `wamid.demo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      },
    });
  }

  console.log(`? Seeded ${messagesToInsert.length} messages across inbox and 14-day timeseries.`);

  // 8. Create 3 Completed & Active Broadcast Campaigns
  await prisma.campaignRecipient.deleteMany({
    where: { campaign: { companyId: company.id } },
  });
  await prisma.campaign.deleteMany({ where: { companyId: company.id } });

  const welcomeTpl = createdTemplates.find((t) => t.name === 'welcome_offer');
  const appointmentTpl = createdTemplates.find((t) => t.name === 'appointment_reminder');
  const vipTpl = createdTemplates.find((t) => t.name === 'vip_seasonal_sale');

  if (welcomeTpl && vipTpl && appointmentTpl) {
    // Campaign 1: Black Friday VIP Early Access (Completed)
    const campaign1 = await prisma.campaign.create({
      data: {
        companyId: company.id,
        templateId: vipTpl.id,
        name: 'Black Friday VIP Early Access',
        status: CampaignStatus.COMPLETED,
        total: customers.length,
        startedAt: new Date(Date.now() - 3600 * 1000 * 48),
        completedAt: new Date(Date.now() - 3600 * 1000 * 47),
        audience: { tagIds: [vipTag.id] },
        variableMap: { '1': 'name', '2': 'VIP_BF_2026' },
      },
    });

    for (let idx = 0; idx < customers.length; idx++) {
      const cust = customers[idx];
      const status = idx === 0 ? MessageStatus.FAILED : (idx % 2 === 0 ? MessageStatus.READ : MessageStatus.DELIVERED);
      await prisma.campaignRecipient.create({
        data: {
          campaignId: campaign1.id,
          customerId: cust.id,
          status,
          attempts: 1,
          waMessageId: `wamid.camp1_${cust.id}_${Date.now()}`,
          sentAt: new Date(Date.now() - 3600 * 1000 * 48),
          deliveredAt: new Date(Date.now() - 3600 * 1000 * 48 + 3000),
          readAt: status === MessageStatus.READ ? new Date(Date.now() - 3600 * 1000 * 47) : null,
          errorCode: status === MessageStatus.FAILED ? '131026' : null,
          errorMessage: status === MessageStatus.FAILED ? 'Receiver phone number inactive' : null,
        },
      });
    }

    // Campaign 2: Q4 Enterprise Feature Launch (Completed)
    const campaign2 = await prisma.campaign.create({
      data: {
        companyId: company.id,
        templateId: welcomeTpl.id,
        name: 'Q4 Enterprise Feature Launch',
        status: CampaignStatus.COMPLETED,
        total: 8,
        startedAt: new Date(Date.now() - 3600 * 1000 * 24),
        completedAt: new Date(Date.now() - 3600 * 1000 * 23),
        audience: { tagIds: [enterpriseTag.id] },
        variableMap: { '1': 'name', '2': 'ENTERPRISE_2026' },
      },
    });

    for (let idx = 0; idx < 8; idx++) {
      const cust = customers[idx];
      await prisma.campaignRecipient.create({
        data: {
          campaignId: campaign2.id,
          customerId: cust.id,
          status: MessageStatus.READ,
          attempts: 1,
          waMessageId: `wamid.camp2_${cust.id}_${Date.now()}`,
          sentAt: new Date(Date.now() - 3600 * 1000 * 24),
          deliveredAt: new Date(Date.now() - 3600 * 1000 * 24 + 2000),
          readAt: new Date(Date.now() - 3600 * 1000 * 23),
        },
      });
    }

    // Campaign 3: Executive Customer Onboarding (Active / Running)
    const campaign3 = await prisma.campaign.create({
      data: {
        companyId: company.id,
        templateId: appointmentTpl.id,
        name: 'Executive Consultation Reminders',
        status: CampaignStatus.RUNNING,
        total: 5,
        startedAt: new Date(Date.now() - 3600 * 1000 * 2),
        audience: { tagIds: [onboardingTag.id] },
        variableMap: { '1': 'name', '2': 'Tomorrow at 2:00 PM EST' },
      },
    });

    for (let idx = 0; idx < 5; idx++) {
      const cust = customers[idx];
      await prisma.campaignRecipient.create({
        data: {
          campaignId: campaign3.id,
          customerId: cust.id,
          status: MessageStatus.DELIVERED,
          attempts: 1,
          waMessageId: `wamid.camp3_${cust.id}_${Date.now()}`,
          sentAt: new Date(Date.now() - 3600 * 1000 * 2),
          deliveredAt: new Date(Date.now() - 3600 * 1000 * 2 + 1500),
        },
      });
    }

    console.log('? 3 Showcase campaigns created with delivery rates, read receipts, and recipient logs.');
  }

  console.log('\n======================================================');
  console.log('?? SHOWCASE DEMO SEEDING COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
  console.log('Primary Showcase Credentials (For HRs, Friends & Recruiters):');
  console.log('  URL:      https://wavedesk-crm.vercel.app/auth/login');
  console.log('  Email:    demo@wavedesk.io');
  console.log('  Password: Demo@2026!');
  console.log('------------------------------------------------------');
  console.log('Alternative Admin Credentials:');
  console.log('  Email:    admin@wavedesk.io');
  console.log('  Password: Password123!');
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
