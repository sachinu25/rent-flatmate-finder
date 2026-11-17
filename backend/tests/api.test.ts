import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

import { createListing, createUser, resetDb } from './helpers.js';

let ownerToken: string;
let tenantToken: string;
let ownerId: string;
let tenantId: string;
let listingId: string;

// 1×1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

beforeAll(async () => {
  await resetDb();
  const owner = await createUser('OWNER');
  const tenant = await createUser('TENANT');
  ownerId = owner.user.id;
  tenantId = tenant.user.id;
  ownerToken = owner.token;
  tenantToken = tenant.token;
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe('Listing CRUD', () => {
  it('POST /api/listings — owner can create (with a real image)', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'Test Room')
      .field('description', 'A nice test room for integration tests')
      .field('location', 'Mumbai')
      .field('locality', 'Andheri')
      .field('rent', '15000')
      .field('availableFrom', '2026-08-01')
      .field('roomType', 'SINGLE')
      .field('furnishingStatus', 'FURNISHED')
      .field('amenities', '["wifi","parking"]')
      .field('rules', '["no-smoking"]')
      .field('petsAllowed', 'false')
      .attach('photos', PNG, { filename: 'room.png', contentType: 'image/png' })
      .expect(201);

    expect(res.body.data.listing.title).toBe('Test Room');
    expect(res.body.data.listing.ownerId).toBe(ownerId);
    expect(res.body.data.listing.petsAllowed).toBe(false);
    expect(res.body.data.listing.photos).toHaveLength(1);
    listingId = res.body.data.listing.id as string;
  });

  it('rejects a non-image disguised with an image mimetype (stored XSS guard)', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'Malicious')
      .field('description', 'Trying to upload an HTML file as an image')
      .field('location', 'Mumbai')
      .field('rent', '15000')
      .field('availableFrom', '2026-08-01')
      .field('roomType', 'SINGLE')
      .field('furnishingStatus', 'FURNISHED')
      .attach('photos', Buffer.from('<html><script>alert(1)</script></html>'), { filename: 'x.html', contentType: 'image/png' })
      .expect(400);
    expect(res.body.message).toMatch(/JPEG, PNG or WebP/);
  });

  it('malformed amenities JSON does not crash the server', async () => {
    await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'Comma list amenities')
      .field('description', 'Amenities provided as a comma separated list')
      .field('location', 'Pune')
      .field('rent', '9000')
      .field('availableFrom', '2026-08-01')
      .field('roomType', 'SHARED')
      .field('furnishingStatus', 'UNFURNISHED')
      .field('amenities', 'wifi, [broken')
      .expect(201);
  });

  it('POST /api/listings — tenant cannot create', async () => {
    await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${tenantToken}`)
      .field('title', 'Hack')
      .expect(403);
  });

  it('POST /api/listings — ignores mass-assigned ownerId/status', async () => {
    const other = await createUser('OWNER');
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${other.token}`)
      .field('title', 'Mass assignment attempt')
      .field('description', 'Should be owned by the authenticated user')
      .field('location', 'Delhi')
      .field('rent', '12000')
      .field('availableFrom', '2026-08-01')
      .field('roomType', 'SINGLE')
      .field('furnishingStatus', 'FURNISHED')
      .field('ownerId', ownerId)
      .field('viewCount', '9999')
      .expect(201);
    expect(res.body.data.listing.ownerId).toBe(other.user.id);
    expect(res.body.data.listing.viewCount).toBe(0);
  });

  it('GET /api/listings/:id — public detail hides owner contact info', async () => {
    const res = await request(app).get(`/api/listings/${listingId}`).expect(200);
    expect(res.body.data.listing.id).toBe(listingId);
    expect(res.body.data.listing.owner.firstName).toBe('Test');
    expect(res.body.data.listing.owner.email).toBeUndefined();
    expect(res.body.data.listing.owner.phone).toBeUndefined();
  });

  it('GET /api/listings/mine — owner sees own listings with counts', async () => {
    const res = await request(app).get('/api/listings/mine').set('Authorization', `Bearer ${ownerToken}`).expect(200);
    expect(res.body.data.listings.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.listings[0]).toHaveProperty('pendingInterests');
  });

  it('PUT /api/listings/:id — owner can update own listing', async () => {
    const res = await request(app)
      .put(`/api/listings/${listingId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'Updated Room')
      .field('rent', '18000')
      .expect(200);
    expect(res.body.data.listing.title).toBe('Updated Room');
    expect(res.body.data.listing.rent).toBe(18000);
  });

  it('PUT /api/listings/:id — another owner cannot update it', async () => {
    const other = await createUser('OWNER');
    await request(app)
      .put(`/api/listings/${listingId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .field('title', 'Hijacked')
      .expect(403);
  });

  it('PATCH /api/listings/:id/status — validates and toggles', async () => {
    await request(app)
      .patch(`/api/listings/${listingId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'NOPE' })
      .expect(400);
    const res = await request(app)
      .patch(`/api/listings/${listingId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'FILLED' })
      .expect(200);
    expect(res.body.data.listing.status).toBe('FILLED');
    await request(app)
      .patch(`/api/listings/${listingId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
  });

  it('DELETE /api/listings/:id — owner can delete own listing', async () => {
    await request(app).delete(`/api/listings/${listingId}`).set('Authorization', `Bearer ${ownerToken}`).expect(200);
    await request(app).get(`/api/listings/${listingId}`).expect(404);
  });
});

describe('Listing browse, filters, sorting, pagination', () => {
  beforeEach(async () => {
    await prisma.listing.deleteMany();
    const base = {
      ownerId,
      description: 'Test listing description here',
      availableFrom: new Date('2026-08-01'),
      furnishingStatus: 'FURNISHED' as const,
      rules: [],
      maxOccupants: 1,
    };
    await prisma.listing.createMany({
      data: [
        { ...base, title: 'Mumbai Single', location: 'Mumbai', locality: 'Andheri', rent: 10000, roomType: 'SINGLE', status: 'ACTIVE', amenities: ['wifi', 'ac'] },
        { ...base, title: 'Mumbai Double', location: 'Mumbai', rent: 20000, roomType: 'DOUBLE', status: 'ACTIVE', amenities: ['wifi'], genderPreference: 'FEMALE' },
        { ...base, title: 'Delhi Studio', location: 'Delhi', rent: 15000, roomType: 'STUDIO', status: 'ACTIVE', amenities: ['wifi', 'ac', 'gym'] },
        { ...base, title: 'Bangalore Apt', location: 'Bangalore', rent: 25000, roomType: 'APARTMENT', status: 'ACTIVE', amenities: [], genderPreference: 'MALE' },
        { ...base, title: 'Mumbai Filled', location: 'Mumbai', rent: 12000, roomType: 'SINGLE', status: 'FILLED', amenities: [] },
      ],
    });
  });

  it('returns only ACTIVE listings by default', async () => {
    const res = await request(app).get('/api/listings').expect(200);
    expect(res.body.data.listings).toHaveLength(4);
  });

  it('includes FILLED when includeFilled=true', async () => {
    const res = await request(app).get('/api/listings?includeFilled=true').expect(200);
    expect(res.body.data.listings).toHaveLength(5);
  });

  it('filters by location (case insensitive) and by city alias', async () => {
    const a = await request(app).get('/api/listings?location=mumbai').expect(200);
    expect(a.body.data.listings).toHaveLength(2);
    const b = await request(app).get('/api/listings?city=MUMBAI').expect(200);
    expect(b.body.data.listings).toHaveLength(2);
  });

  it('full-text style search across title/locality', async () => {
    const res = await request(app).get('/api/listings?q=andheri').expect(200);
    expect(res.body.data.listings.map((l: { title: string }) => l.title)).toEqual(['Mumbai Single']);
  });

  it('filters by rent range, room type and amenities', async () => {
    const r = await request(app).get('/api/listings?minRent=12000&maxRent=20000').expect(200);
    expect((r.body.data.listings as { rent: number }[]).every((l) => l.rent >= 12000 && l.rent <= 20000)).toBe(true);
    const s = await request(app).get('/api/listings?roomType=STUDIO').expect(200);
    expect(s.body.data.listings[0].title).toBe('Delhi Studio');
    const a = await request(app).get('/api/listings?amenities=wifi,ac').expect(200);
    expect(a.body.data.listings).toHaveLength(2);
  });

  it('gender preference filter includes ANY listings', async () => {
    const res = await request(app).get('/api/listings?genderPreference=FEMALE').expect(200);
    const titles = (res.body.data.listings as { title: string }[]).map((l) => l.title);
    expect(titles).toContain('Mumbai Double');
    expect(titles).not.toContain('Bangalore Apt');
    expect(titles).toHaveLength(3);
  });

  it('sorts by rent', async () => {
    const res = await request(app).get('/api/listings?sort=rent_asc').expect(200);
    const rents = (res.body.data.listings as { rent: number }[]).map((l) => l.rent);
    expect(rents).toEqual([...rents].sort((x, y) => x - y));
  });

  it('rejects invalid query params with 400 (not 500)', async () => {
    await request(app).get('/api/listings?roomType=CASTLE').expect(400);
    await request(app).get('/api/listings?limit=500').expect(400);
  });

  it('pagination works', async () => {
    const res = await request(app).get('/api/listings?limit=2&page=1').expect(200);
    expect(res.body.data.listings).toHaveLength(2);
    expect(res.body.data.pagination).toMatchObject({ total: 4, totalPages: 2 });
    const page2 = await request(app).get('/api/listings?limit=2&page=2').expect(200);
    expect(page2.body.data.listings).toHaveLength(2);
  });
});

describe('Tenant profile + compatibility', () => {
  it('GET /api/profile — returns null before creation', async () => {
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${tenantToken}`).expect(200);
    expect(res.body.data.profile).toBeNull();
  });

  it('POST /api/profile — tenant can create profile with lifestyle data', async () => {
    const res = await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        preferredLocation: 'Mumbai', budgetMin: 8000, budgetMax: 20000, moveInDate: '2026-08-01',
        occupation: 'Engineer', bio: 'Looking for a quiet place', smoking: 'NON_SMOKER', cleanliness: 4, hasPets: false,
      })
      .expect(200);
    expect(res.body.data.profile.preferredLocation).toBe('Mumbai');
    expect(res.body.data.profile.cleanliness).toBe(4);
  });

  it('POST /api/profile — rejects budgetMax < budgetMin', async () => {
    await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ preferredLocation: 'Mumbai', budgetMin: 20000, budgetMax: 10000, moveInDate: '2026-08-01' })
      .expect(400);
  });

  it('POST /api/profile — owner cannot create profile', async () => {
    await request(app)
      .post('/api/profile')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ preferredLocation: 'X', budgetMin: 0, budgetMax: 1000, moveInDate: '2026-08-01' })
      .expect(403);
  });

  it('browsing as a tenant returns rule-based scores and caches them', async () => {
    await prisma.listing.deleteMany();
    const l = await createListing(ownerId, { location: 'Mumbai', rent: 12000, availableFrom: new Date('2026-07-15') });
    const res = await request(app).get('/api/listings').set('Authorization', `Bearer ${tenantToken}`).expect(200);
    const c = res.body.data.listings[0].compatibility;
    expect(c.computedVia).toBe('FALLBACK');
    expect(c.score).toBeGreaterThanOrEqual(80);
    const cached = await prisma.compatibilityScore.findUnique({ where: { tenantId_listingId: { tenantId, listingId: l.id } } });
    expect(cached?.inputHash).toBeTruthy();
  });

  it('AI analysis falls back to rule-based scoring when no provider is configured', async () => {
    const l = await prisma.listing.findFirstOrThrow();
    const res = await request(app)
      .post(`/api/compatibility/${l.id}/analyze`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .expect(200);
    expect(res.body.data.aiUsed).toBe(false);
    expect(res.body.data.compatibility.computedVia).toBe('FALLBACK');
    expect(res.body.data.compatibility.factors.breakdown.length).toBeGreaterThanOrEqual(3);
  });

  it('sort=match ranks across pages, not just within one page', async () => {
    await prisma.listing.deleteMany();
    // Newest listing is the worst match; best match is the oldest.
    await createListing(ownerId, { title: 'Best', location: 'Mumbai', rent: 9000, createdAt: new Date('2026-01-01') });
    await createListing(ownerId, { title: 'Middle', location: 'Mumbai', rent: 26000, createdAt: new Date('2026-02-01') });
    await createListing(ownerId, { title: 'Worst', location: 'Kolkata', rent: 90000, createdAt: new Date('2026-03-01') });
    const res = await request(app).get('/api/listings?sort=match&limit=1&page=1').set('Authorization', `Bearer ${tenantToken}`).expect(200);
    expect(res.body.data.listings[0].title).toBe('Best');
    expect(res.body.data.pagination.total).toBe(3);
  });

  it('POST /api/listings/:id/view counts visitors but not the owner', async () => {
    const l = await prisma.listing.findFirstOrThrow();
    await request(app).post(`/api/listings/${l.id}/view`).expect(200);
    await request(app).post(`/api/listings/${l.id}/view`).set('Authorization', `Bearer ${ownerToken}`).expect(200);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).viewCount).toBe(1);
  });

  it('GET /api/compatibility/matches returns ranked listings', async () => {
    const res = await request(app).get('/api/compatibility/matches').set('Authorization', `Bearer ${tenantToken}`).expect(200);
    expect(res.body.data.matches.length).toBeGreaterThanOrEqual(1);
  });
});
