import { PrismaClient, Role, TemplateCategory, TemplateStatus, Direction, MessageStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { encrypt } from '../src/services/encryption';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Wavedesk demo database...');

  // 1. Create or find Demo Company
  const company = await prisma.company.upsert({
    where: { id: 'demo-company-wavedesk' },
    update: {},
    create: {
      id: 'demo-company-wavedesk',
      name: 'Acme Enterprise',
      phoneNumberId: '109876543210987',
      wabaId: '123456789012345',
      encAccessToken: encrypt('mock_access_token_demo_123456789'),
      encAppSecret: encrypt(process.env.META_APP_SECRET || 'mock_app_secret'),
      verifyToken: process.env.META_VERIFY_TOKEN || 'wavedesk_verify_token_123',
    },
  });

  console.log(`✓ Company ready: ${company.name} (${company.id})`);

  // 2. Create Owner User
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@wavedesk.io' },
    update: { passwordHash },
    create: {
      companyId: company.id,
      name: 'Vamshi Admin',
      email: 'admin@wavedesk.io',
      passwordHash,
      role: Role.OWNER,
    },
  });

  console.log(`✓ Demo user ready: ${user.email} (Password: Password123!)`);

  // 3. Create Contact Types
  const customerType = await prisma.contactType.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Customer' } },
    update: {},
    create: { companyId: company.id, name: 'Customer', color: '#10B981' },
  });

  const leadType = await prisma.contactType.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Prospect' } },
    update: {},
    create: { companyId: company.id, name: 'Prospect', color: '#3B82F6' },
  });

  // 4. Create Tags
  const vipTag = await prisma.tag.upsert({
    where: { companyId_name: { companyId: company.id, name: 'VIP' } },
    update: {},
    create: { companyId: company.id, name: 'VIP', color: '#10B981' },
  });

  const highIntentTag = await prisma.tag.upsert({
    where: { companyId_name: { companyId: company.id, name: 'High-Intent' } },
    update: {},
    create: { companyId: company.id, name: 'High-Intent', color: '#3B82F6' },
  });

  // 5. Create Sample Customers
  const customer1 = await prisma.customer.upsert({
    where: { companyId_phone: { companyId: company.id, phone: '15559876543' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Sarah Jenkins',
      phone: '15559876543',
      contactTypeId: customerType.id,
      lastCustomerMessageAt: new Date(), // Active 24-hr messaging window
      lastMessageAt: new Date(),
      tags: { connect: [{ id: vipTag.id }] },
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { companyId_phone: { companyId: company.id, phone: '15551234567' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Alex Rivera',
      phone: '15551234567',
      contactTypeId: leadType.id,
      lastCustomerMessageAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      lastMessageAt: new Date(Date.now() - 3600 * 1000),
      tags: { connect: [{ id: highIntentTag.id }] },
    },
  });

  console.log(`✓ Sample customers created: ${customer1.name}, ${customer2.name}`);

  // 6. Create Sample Approved WhatsApp Templates
  const template1 = await prisma.template.upsert({
    where: {
      companyId_name_language: {
        companyId: company.id,
        name: 'welcome_offer',
        language: 'en_US',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      name: 'welcome_offer',
      language: 'en_US',
      category: TemplateCategory.MARKETING,
      status: TemplateStatus.APPROVED,
      metaId: 'mock_meta_welcome_1',
      components: [
        { type: 'HEADER', format: 'TEXT', text: 'Welcome to Wavedesk!' },
        { type: 'BODY', text: 'Hi {{1}}, welcome! Use code {{2}} to get 20% off your first order.' },
        { type: 'FOOTER', text: 'Reply STOP to opt out' },
      ],
    },
  });

  const template2 = await prisma.template.upsert({
    where: {
      companyId_name_language: {
        companyId: company.id,
        name: 'appointment_reminder',
        language: 'en_US',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      name: 'appointment_reminder',
      language: 'en_US',
      category: TemplateCategory.UTILITY,
      status: TemplateStatus.APPROVED,
      metaId: 'mock_meta_appointment_2',
      components: [
        { type: 'BODY', text: 'Hello {{1}}, reminder for your appointment scheduled on {{2}}.' },
        { type: 'FOOTER', text: 'Wavedesk Support' },
      ],
    },
  });

  console.log(`✓ Approved templates created: ${template1.name}, ${template2.name}`);

  // 7. Seed Sample Inbox Messages
  const existingMessages = await prisma.message.count({ where: { companyId: company.id } });
  if (existingMessages === 0) {
    await prisma.message.createMany({
      data: [
        {
          companyId: company.id,
          customerId: customer1.id,
          direction: Direction.INBOUND,
          status: MessageStatus.DELIVERED,
          body: 'Hello! I am inquiring about your software plans.',
          waMessageId: `wamid.demo_inbound_${Date.now()}`,
          createdAt: new Date(Date.now() - 1000 * 60 * 30),
        },
        {
          companyId: company.id,
          customerId: customer1.id,
          direction: Direction.OUTBOUND,
          status: MessageStatus.READ,
          body: 'Hi Sarah, thanks for reaching out! We would be delighted to help.',
          waMessageId: `wamid.demo_outbound_${Date.now()}`,
          createdAt: new Date(Date.now() - 1000 * 60 * 25),
        },
      ],
    });
    console.log('✓ Initial conversation messages seeded in shared inbox.');
  }

  console.log('\n--- Seeding Complete ---');
  console.log('Login credentials:');
  console.log('  URL:      http://localhost:3000/auth/login');
  console.log('  Email:    admin@wavedesk.io');
  console.log('  Password: Password123!\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
