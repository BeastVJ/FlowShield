import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user
  const passwordHash = await bcrypt.hash('Password123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@flowshield.dev' },
    update: {},
    create: {
      email: 'demo@flowshield.dev',
      name: 'Demo User',
      passwordHash,
      emailVerified: true,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Created user: ${user.email}`);

  // Create demo project
  const project = await prisma.project.upsert({
    where: { id: 'demo-project' },
    update: {},
    create: {
      id: 'demo-project',
      name: 'Demo Project',
      description: 'A demo project for testing FlowShield',
      ownerId: user.id,
    },
  });

  console.log(`✅ Created project: ${project.name}`);

  // Create demo API key with policy
  const apiKey = await prisma.apiKey.upsert({
    where: { key: 'fs_demo_key_for_testing_purposes_only' },
    update: {},
    create: {
      key: 'fs_demo_key_for_testing_purposes_only',
      name: 'Demo API Key',
      projectId: project.id,
      policy: {
        create: {
          algorithm: 'FIXED_WINDOW',
          maxRequests: 100,
          windowMs: 60000,
        },
      },
    },
  });

  console.log(`✅ Created API key: ${apiKey.name}`);

  // Create additional API keys with different algorithms
  const algorithms = ['SLIDING_WINDOW', 'SLIDING_LOG', 'TOKEN_BUCKET', 'LEAKY_BUCKET'] as const;
  for (const algorithm of algorithms) {
    const key = `fs_demo_${algorithm.toLowerCase()}_key`;
    await prisma.apiKey.upsert({
      where: { key },
      update: {},
      create: {
        key,
        name: `Demo ${algorithm} Key`,
        projectId: project.id,
        policy: {
          create: {
            algorithm,
            maxRequests: 50,
            windowMs: 60000,
            burstCapacity: algorithm === 'TOKEN_BUCKET' || algorithm === 'LEAKY_BUCKET' ? 75 : undefined,
            refillRate: algorithm === 'TOKEN_BUCKET' || algorithm === 'LEAKY_BUCKET' ? 10 : undefined,
          },
        },
      },
    });
    console.log(`✅ Created ${algorithm} API key`);
  }

  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
