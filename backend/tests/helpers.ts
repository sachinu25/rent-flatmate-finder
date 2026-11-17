import bcrypt from 'bcrypt';

import { generateAccessToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

export async function resetDb() {
  await prisma.notification.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.interestRequest.deleteMany();
  await prisma.compatibilityScore.deleteMany();
  await prisma.savedListing.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.listingPhoto.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.tenantProfile.deleteMany();
  await prisma.user.deleteMany();
}

let counter = 0;
export async function createUser(role: 'TENANT' | 'OWNER' | 'ADMIN', overrides: { email?: string } = {}) {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      email: overrides.email ?? `${role.toLowerCase()}-${counter}-${Date.now()}@test.dev`,
      hashedPassword: await bcrypt.hash('Test1234', 4),
      firstName: 'Test',
      lastName: role === 'OWNER' ? 'Owner' : 'Tenant',
      role,
    },
  });
  return { user, token: generateAccessToken({ userId: user.id, role }) };
}

export async function createListing(ownerId: string, overrides: Record<string, unknown> = {}) {
  return prisma.listing.create({
    data: {
      ownerId,
      title: 'Test listing',
      description: 'A perfectly reasonable test listing description',
      location: 'Mumbai',
      rent: 15000,
      availableFrom: new Date('2026-01-01'),
      roomType: 'SINGLE',
      furnishingStatus: 'FURNISHED',
      amenities: ['wifi'],
      rules: [],
      ...overrides,
    },
  });
}

/** Extract the refresh cookie value from a Set-Cookie header. */
export function refreshCookie(setCookie: string[] | string | undefined): string | null {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const c = list.find((x) => x.startsWith('rff_rt='));
  if (!c) return null;
  const value = c.split(';')[0]!.slice('rff_rt='.length);
  return value ? `rff_rt=${value}` : null;
}
