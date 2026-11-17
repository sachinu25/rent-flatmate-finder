import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

import { createListing, createUser, refreshCookie, resetDb } from './helpers.js';

beforeAll(resetDb);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

const CSRF = { 'X-Requested-With': 'fetch' };

describe('Authentication & sessions', () => {
  const email = 'flow@test.dev';
  const password = 'Str0ngPassw0rd';
  let cookie: string;

  it('registers and sets an httpOnly refresh cookie (no token in body)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password, firstName: 'Flow', lastName: 'User', role: 'TENANT' })
      .expect(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.body.data.user.hashedPassword).toBeUndefined();
    const raw = res.headers['set-cookie'] as unknown as string[];
    expect(raw.join(';')).toMatch(/HttpOnly/i);
    expect(raw.join(';')).toMatch(/Path=\/api\/auth/);
    cookie = refreshCookie(raw)!;
    expect(cookie).toBeTruthy();
  });

  it('rejects duplicate email and weak passwords', async () => {
    await request(app).post('/api/auth/register').send({ email, password, firstName: 'A', lastName: 'B', role: 'TENANT' }).expect(409);
    await request(app).post('/api/auth/register').send({ email: 'weak@test.dev', password: 'password', firstName: 'A', lastName: 'B', role: 'TENANT' }).expect(400);
  });

  it('cannot self-register as ADMIN', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'evil@test.dev', password, firstName: 'A', lastName: 'B', role: 'ADMIN' })
      .expect(400);
  });

  it('login fails with the same message for unknown email and wrong password', async () => {
    const a = await request(app).post('/api/auth/login').send({ email: 'nobody@test.dev', password }).expect(401);
    const b = await request(app).post('/api/auth/login').send({ email, password: 'Wrong1234' }).expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('refresh requires the CSRF header', async () => {
    await request(app).post('/api/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('refresh rotates the token; reusing the old one revokes the session family', async () => {
    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie).set(CSRF).expect(200);
    const rotated = refreshCookie(first.headers['set-cookie'] as unknown as string[])!;
    expect(rotated).not.toBe(cookie);

    // Replay of the old token → theft detected
    await request(app).post('/api/auth/refresh').set('Cookie', cookie).set(CSRF).expect(401);
    // ...and the legitimately rotated token is now revoked too
    await request(app).post('/api/auth/refresh').set('Cookie', rotated).set(CSRF).expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
    const c = refreshCookie(login.headers['set-cookie'] as unknown as string[])!;
    await request(app).post('/api/auth/logout').set('Cookie', c).expect(200);
    await request(app).post('/api/auth/refresh').set('Cookie', c).set(CSRF).expect(401);
  });

  it('rejects tampered / wrong-type tokens', async () => {
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
    await request(app).get('/api/auth/me').expect(401);
  });

  it('deactivated users are rejected even with a valid access token', async () => {
    const { user, token } = await createUser('TENANT');
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });
});

describe('Interest requests, chat authorization, wishlist', () => {
  it('full flow with race-safe accept and participant-only chat access', async () => {
    const owner = await createUser('OWNER');
    const tenant = await createUser('TENANT');
    const stranger = await createUser('TENANT');
    const listing = await createListing(owner.user.id);

    // Duplicate requests (e.g. double click) → exactly one succeeds
    const [a, b] = await Promise.all([
      request(app).post('/api/interests').set('Authorization', `Bearer ${tenant.token}`).send({ listingId: listing.id, message: 'Hi' }),
      request(app).post('/api/interests').set('Authorization', `Bearer ${tenant.token}`).send({ listingId: listing.id, message: 'Hi' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const interestId = (a.status === 201 ? a : b).body.data.interest.id as string;

    // Owner notified (notifications are fire-and-forget, so wait for the write)
    await expect
      .poll(() => prisma.notification.count({ where: { userId: owner.user.id, type: 'INTEREST_RECEIVED' } }), { timeout: 3000 })
      .toBe(1);

    // Another owner cannot resolve it
    const other = await createUser('OWNER');
    await request(app).patch(`/api/interests/${interestId}`).set('Authorization', `Bearer ${other.token}`).send({ status: 'ACCEPTED' }).expect(403);

    // Concurrent accept → exactly one conversation
    const [x, y] = await Promise.all([
      request(app).patch(`/api/interests/${interestId}`).set('Authorization', `Bearer ${owner.token}`).send({ status: 'ACCEPTED' }),
      request(app).patch(`/api/interests/${interestId}`).set('Authorization', `Bearer ${owner.token}`).send({ status: 'ACCEPTED' }),
    ]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
    expect(await prisma.conversation.count({ where: { interestRequestId: interestId } })).toBe(1);
    const conversationId = (x.status === 200 ? x : y).body.data.conversationId as string;

    // Participants can read messages; a stranger cannot
    await request(app).get(`/api/chat/${conversationId}/messages`).set('Authorization', `Bearer ${tenant.token}`).expect(200);
    await request(app).get(`/api/chat/${conversationId}/messages`).set('Authorization', `Bearer ${owner.token}`).expect(200);
    await request(app).get(`/api/chat/${conversationId}/messages`).set('Authorization', `Bearer ${stranger.token}`).expect(403);
    await request(app).post(`/api/chat/${conversationId}/read`).set('Authorization', `Bearer ${stranger.token}`).expect(403);

    const convs = await request(app).get('/api/chat/conversations').set('Authorization', `Bearer ${tenant.token}`).expect(200);
    expect(convs.body.data.conversations).toHaveLength(1);
    expect(convs.body.data.conversations[0]).toHaveProperty('unreadCount', 0);

    // Tenant cannot withdraw an accepted request
    await request(app).delete(`/api/interests/${interestId}`).set('Authorization', `Bearer ${tenant.token}`).expect(404);
  });

  it('wishlist is idempotent and per-user', async () => {
    const owner = await createUser('OWNER');
    const tenant = await createUser('TENANT');
    const listing = await createListing(owner.user.id);

    await request(app).put(`/api/saved/${listing.id}`).set('Authorization', `Bearer ${tenant.token}`).expect(200);
    await request(app).put(`/api/saved/${listing.id}`).set('Authorization', `Bearer ${tenant.token}`).expect(200);
    const list = await request(app).get('/api/saved').set('Authorization', `Bearer ${tenant.token}`).expect(200);
    expect(list.body.data.listings).toHaveLength(1);

    const detail = await request(app).get(`/api/listings/${listing.id}`).set('Authorization', `Bearer ${tenant.token}`).expect(200);
    expect(detail.body.data.viewer.isSaved).toBe(true);

    await request(app).delete(`/api/saved/${listing.id}`).set('Authorization', `Bearer ${tenant.token}`).expect(200);
    const after = await request(app).get('/api/saved').set('Authorization', `Bearer ${tenant.token}`).expect(200);
    expect(after.body.data.listings).toHaveLength(0);
  });

  it('notifications are scoped to their owner', async () => {
    const a = await createUser('TENANT');
    const b = await createUser('TENANT');
    const n = await prisma.notification.create({ data: { userId: a.user.id, type: 'SYSTEM', title: 't', message: 'm' } });
    await request(app).patch(`/api/notifications/${n.id}/read`).set('Authorization', `Bearer ${b.token}`).expect(200);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).read).toBe(false);
    await request(app).patch(`/api/notifications/${n.id}/read`).set('Authorization', `Bearer ${a.token}`).expect(200);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).read).toBe(true);
  });

  it('owner dashboard returns real counts', async () => {
    const owner = await createUser('OWNER');
    await createListing(owner.user.id);
    await createListing(owner.user.id, { status: 'FILLED' });
    const res = await request(app).get('/api/dashboard/owner').set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(res.body.data.stats).toMatchObject({ totalListings: 2, activeListings: 1, filledListings: 1 });
  });

  it('admin endpoints require the ADMIN role', async () => {
    const t = await createUser('TENANT');
    await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${t.token}`).expect(403);
    const admin = await createUser('ADMIN');
    await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${admin.token}`).expect(200);
  });
});

describe('Hardening', () => {
  it('malformed JSON returns 400', async () => {
    await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":').expect(400);
  });

  it('unknown routes return 404 JSON', async () => {
    const res = await request(app).get('/api/does-not-exist').expect(404);
    expect(res.body.status).toBe('error');
  });

  it('security headers are present', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('CORS rejects unknown origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
