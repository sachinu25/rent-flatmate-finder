// ──────────────────────────────────────────────────────────────────────────────
// Prisma Seed — DEMO DATA for local development and review environments.
//
//   • 1 admin, 3 owners, 4 tenants (with lifestyle profiles)
//   • 10 listings across Mumbai, Bangalore and Delhi with photos
//   • Interest requests (pending / accepted / declined) and one conversation
//
// No compatibility scores are inserted: they are computed by the app (rule-based
// instantly, AI on request) so nothing here pretends to be AI output.
//
// Every demo account uses the password from SEED_PASSWORD (default below).
// Refuses to run when NODE_ENV=production unless ALLOW_DEMO_SEED=true.
//
// Run: npx prisma db seed
// ──────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';

import {
  FoodPreference,
  FurnishingStatus,
  InterestStatus,
  NotificationType,
  PrismaClient,
  RoomSharingPreference,
  RoomType,
  SleepSchedule,
  SmokingHabit,
  UserRole,
  WorkSchedule,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env['SEED_PASSWORD'] ?? 'Password123!';

/** Date `days` from today (keeps demo availability realistic whenever seeded). */
const fromToday = (days: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=1600&q=80&auto=format&fit=crop`;

async function main() {
  if (process.env['NODE_ENV'] === 'production' && process.env['ALLOW_DEMO_SEED'] !== 'true') {
    throw new Error('Refusing to seed demo data in production. Set ALLOW_DEMO_SEED=true to override.');
  }

  console.log('🌱 Seeding demo data...\n');

  // ── Clean (reverse dependency order) ──
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

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);

  // ── Users ──
  await prisma.user.create({
    data: { email: 'admin@rentfinder.com', hashedPassword, firstName: 'System', lastName: 'Admin', role: UserRole.ADMIN },
  });

  const [priya, rajesh, anita] = await Promise.all(
    [
      { email: 'priya.sharma@email.com', firstName: 'Priya', lastName: 'Sharma', phone: '+91 98765 43210' },
      { email: 'rajesh.kumar@email.com', firstName: 'Rajesh', lastName: 'Kumar', phone: '+91 98765 43211' },
      { email: 'anita.desai@email.com', firstName: 'Anita', lastName: 'Desai', phone: '+91 98765 43212' },
    ].map((o) => prisma.user.create({ data: { ...o, hashedPassword, role: UserRole.OWNER } })),
  );

  const [amit, sneha, vikram, meera] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'amit.patel@email.com', hashedPassword, firstName: 'Amit', lastName: 'Patel', phone: '+91 91234 56780', role: UserRole.TENANT,
        tenantProfile: {
          create: {
            preferredLocation: 'Mumbai', budgetMin: 8000, budgetMax: 15000, moveInDate: fromToday(21),
            occupation: 'Software Engineer', lifestyle: 'Early riser, non-smoker, vegetarian',
            bio: 'Working professional looking for a clean, quiet home in Mumbai. I work from home three days a week and enjoy cooking.',
            cleanliness: 5, sleepSchedule: SleepSchedule.EARLY_BIRD, workSchedule: WorkSchedule.HYBRID,
            foodPreference: FoodPreference.VEGETARIAN, smoking: SmokingHabit.NON_SMOKER, hasPets: false,
            roomSharing: RoomSharingPreference.PRIVATE_ROOM,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'sneha.reddy@email.com', hashedPassword, firstName: 'Sneha', lastName: 'Reddy', phone: '+91 91234 56781', role: UserRole.TENANT,
        tenantProfile: {
          create: {
            preferredLocation: 'Bangalore', budgetMin: 10000, budgetMax: 20000, moveInDate: fromToday(14),
            occupation: 'Data Scientist', lifestyle: 'Night owl, social, fitness enthusiast',
            bio: 'Looking for a modern furnished room near the tech parks. Happy to share with like-minded professionals.',
            cleanliness: 4, sleepSchedule: SleepSchedule.NIGHT_OWL, workSchedule: WorkSchedule.OFFICE,
            foodPreference: FoodPreference.NON_VEGETARIAN, smoking: SmokingHabit.NON_SMOKER, hasPets: false,
            roomSharing: RoomSharingPreference.NO_PREFERENCE,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'vikram.singh@email.com', hashedPassword, firstName: 'Vikram', lastName: 'Singh', phone: '+91 91234 56782', role: UserRole.TENANT,
        tenantProfile: {
          create: {
            preferredLocation: 'Delhi', budgetMin: 5000, budgetMax: 12000, moveInDate: fromToday(30),
            occupation: 'Graduate Student', lifestyle: 'Quiet, studious, non-smoker, vegetarian',
            bio: 'Masters student looking for affordable accommodation near the university. I prefer a quiet environment for studying.',
            cleanliness: 4, sleepSchedule: SleepSchedule.EARLY_BIRD, workSchedule: WorkSchedule.STUDENT,
            foodPreference: FoodPreference.VEGETARIAN, smoking: SmokingHabit.NON_SMOKER, hasPets: false,
            roomSharing: RoomSharingPreference.NO_PREFERENCE,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'meera.nair@email.com', hashedPassword, firstName: 'Meera', lastName: 'Nair', phone: '+91 91234 56783', role: UserRole.TENANT,
        tenantProfile: {
          create: {
            preferredLocation: 'Mumbai', budgetMin: 12000, budgetMax: 25000, moveInDate: fromToday(10),
            occupation: 'Marketing Manager', lifestyle: 'Social, pet parent, occasional cook',
            bio: 'Looking for a well-furnished place in a good society. I have a small, well-trained dog.',
            cleanliness: 3, sleepSchedule: SleepSchedule.FLEXIBLE, workSchedule: WorkSchedule.OFFICE,
            foodPreference: FoodPreference.NON_VEGETARIAN, smoking: SmokingHabit.NON_SMOKER, hasPets: true,
            roomSharing: RoomSharingPreference.PRIVATE_ROOM,
          },
        },
      },
    }),
  ]);
  console.log('  ✓ 1 admin, 3 owners, 4 tenants');

  // ── Listings ──
  const listingsData = [
    {
      ownerId: priya!.id, title: 'Sunlit single room near Andheri metro',
      description: 'Well-maintained single room in a 2BHK with a calm flatmate. Five minutes to the metro, supermarkets and cafés. The building has 24/7 security and power backup.',
      location: 'Mumbai', locality: 'Andheri West', address: 'Andheri West, Mumbai 400058',
      rent: 12000, deposit: 24000, availableFrom: fromToday(7), roomType: RoomType.SINGLE, furnishingStatus: FurnishingStatus.FURNISHED,
      amenities: ['wifi', 'ac', 'washing-machine', 'power-backup', 'security'], rules: ['no-smoking', 'quiet-after-10pm'],
      maxOccupants: 1, smokingAllowed: false, petsAllowed: false, foodPolicy: FoodPreference.NO_PREFERENCE,
      householdSleepSchedule: SleepSchedule.EARLY_BIRD, householdCleanliness: 5,
      photos: ['1522708323590-d24dbb6b0267', '1502672260266-1c1ef2d93688', '1484154218962-a197022b5858'],
    },
    {
      ownerId: priya!.id, title: 'Spacious double room with sea view, Bandra',
      description: 'Large double room in a sea-facing apartment. Fully furnished with modern amenities, gym and pool. Walking distance to Bandstand and Carter Road.',
      location: 'Mumbai', locality: 'Bandra West', address: 'Bandra West, Mumbai 400050',
      rent: 22000, deposit: 44000, availableFrom: fromToday(3), roomType: RoomType.DOUBLE, furnishingStatus: FurnishingStatus.FURNISHED,
      amenities: ['wifi', 'ac', 'gym', 'swimming-pool', 'parking', 'sea-view'], rules: ['no-smoking', 'no-pets'],
      maxOccupants: 2, smokingAllowed: false, petsAllowed: false, householdSleepSchedule: SleepSchedule.FLEXIBLE, householdCleanliness: 4,
      photos: ['1560448204-e02f11c3d0e2', '1560185893-a55cbc8c57e8', '1493809842364-78817add7ffb'],
    },
    {
      ownerId: priya!.id, title: 'Budget shared room in Powai',
      description: 'Shared room for students or young professionals near IIT Bombay and Hiranandani Gardens. Basic furniture and full kitchen access included.',
      location: 'Mumbai', locality: 'Powai', address: 'Powai, Mumbai 400076',
      rent: 7000, deposit: 14000, availableFrom: fromToday(0), roomType: RoomType.SHARED, furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
      amenities: ['wifi', 'kitchen-access', 'laundry'], rules: ['no-smoking'],
      maxOccupants: 2, smokingAllowed: false, householdSleepSchedule: SleepSchedule.NIGHT_OWL, householdCleanliness: 3,
      photos: ['1555854877-bab0e564b8d5', '1595526114035-0d45ed16cfbf'],
    },
    {
      ownerId: priya!.id, title: 'Modern studio in Lower Parel',
      description: 'Independent studio apartment with kitchenette and attached bathroom. Ideal for working professionals who value privacy. Pets welcome.',
      location: 'Mumbai', locality: 'Lower Parel', address: 'Lower Parel, Mumbai 400013',
      rent: 18000, deposit: 36000, availableFrom: fromToday(30), roomType: RoomType.STUDIO, furnishingStatus: FurnishingStatus.FURNISHED,
      amenities: ['wifi', 'ac', 'kitchenette', 'power-backup', 'elevator'], rules: ['no-smoking', 'pet-friendly'],
      maxOccupants: 1, smokingAllowed: false, petsAllowed: true,
      photos: ['1536376072261-38c75010e6c9', '1502672023488-70e25813eb80'],
    },
    {
      ownerId: rajesh!.id, title: 'Room next to Whitefield tech parks',
      description: 'Single room in a gated community near ITPL. Quick access to buses and the metro. Gym and covered parking in the complex.',
      location: 'Bangalore', locality: 'Whitefield', address: 'Whitefield, Bangalore 560066',
      rent: 14000, deposit: 28000, availableFrom: fromToday(5), roomType: RoomType.SINGLE, furnishingStatus: FurnishingStatus.FURNISHED,
      amenities: ['wifi', 'ac', 'gym', 'parking', 'power-backup'], rules: ['no-smoking', 'no-pets'],
      maxOccupants: 1, smokingAllowed: false, petsAllowed: false, householdSleepSchedule: SleepSchedule.NIGHT_OWL, householdCleanliness: 4,
      photos: ['1600596542815-ffad4c1539a9', '1600585154340-be6161a56a0c', '1600607687939-ce8a6c25118c'],
    },
    {
      ownerId: rajesh!.id, title: 'Affordable room in Koramangala',
      description: 'Semi-furnished room in a quiet residential lane. Walking distance to Koramangala restaurants, co-working spaces and Forum Mall.',
      location: 'Bangalore', locality: 'Koramangala', address: 'Koramangala 4th Block, Bangalore 560034',
      rent: 11000, deposit: 22000, availableFrom: fromToday(20), roomType: RoomType.SINGLE, furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
      amenities: ['wifi', 'kitchen-access', 'laundry', 'parking'], rules: ['no-smoking', 'vegetarian-kitchen'],
      maxOccupants: 1, smokingAllowed: false, foodPolicy: FoodPreference.VEGETARIAN, householdSleepSchedule: SleepSchedule.EARLY_BIRD, householdCleanliness: 4,
      photos: ['1502672023488-70e25813eb80', '1600566753190-17f0baa2a6c3'],
    },
    {
      ownerId: rajesh!.id, title: 'Premium 2BHK in Indiranagar',
      description: 'Entire 2BHK apartment with premium interiors, modular kitchen and a large balcony, in the heart of Indiranagar.',
      location: 'Bangalore', locality: 'Indiranagar', address: '12th Main, Indiranagar, Bangalore 560038',
      rent: 35000, deposit: 70000, availableFrom: fromToday(25), roomType: RoomType.APARTMENT, furnishingStatus: FurnishingStatus.FURNISHED,
      amenities: ['wifi', 'ac', 'modular-kitchen', 'parking', 'balcony', 'gym'], rules: ['no-smoking-indoors'],
      maxOccupants: 3, petsAllowed: true,
      photos: ['1600047509807-ba8f99d2cdde', '1600573472592-401b489a3cdc', '1600566752355-35792bedcfea'],
    },
    {
      ownerId: anita!.id, title: 'Student-friendly room near Delhi University',
      description: 'Affordable single room ideal for students. Close to North Campus, Hudson Lane and GTB Nagar metro. Quiet household.',
      location: 'Delhi', locality: 'Vijay Nagar', address: 'Vijay Nagar, Delhi 110009',
      rent: 6000, deposit: 12000, availableFrom: fromToday(14), roomType: RoomType.SINGLE, furnishingStatus: FurnishingStatus.UNFURNISHED,
      amenities: ['wifi', 'kitchen-access'], rules: ['no-smoking', 'quiet-hours'],
      maxOccupants: 1, smokingAllowed: false, foodPolicy: FoodPreference.VEGETARIAN, householdSleepSchedule: SleepSchedule.EARLY_BIRD, householdCleanliness: 4,
      photos: ['1523755231516-e43fd2e8dca5', '1484154218962-a197022b5858'],
    },
    {
      ownerId: anita!.id, title: 'Furnished room in Saket',
      description: 'Well-furnished room in a modern apartment near Select Citywalk and the metro. Lift, power backup and parking.',
      location: 'Delhi', locality: 'Saket', address: 'Saket, New Delhi 110017',
      rent: 15000, deposit: 30000, availableFrom: fromToday(10), roomType: RoomType.DOUBLE, furnishingStatus: FurnishingStatus.FURNISHED,
      amenities: ['wifi', 'ac', 'parking', 'power-backup', 'elevator'], rules: ['no-smoking', 'no-pets'],
      maxOccupants: 2, smokingAllowed: false, petsAllowed: false,
      photos: ['1600210492486-724fe5c67fb0', '1600585154526-990dced4db0d', '1600566753086-00f18fb6b3ea'],
    },
    {
      ownerId: anita!.id, title: 'Shared room in Hauz Khas Village',
      description: 'Bohemian shared living for creative professionals, with rooftop access and regular community dinners.',
      location: 'Delhi', locality: 'Hauz Khas', address: 'Hauz Khas, New Delhi 110016',
      rent: 9000, deposit: 18000, availableFrom: fromToday(2), roomType: RoomType.SHARED, furnishingStatus: FurnishingStatus.FURNISHED,
      amenities: ['wifi', 'rooftop-access', 'laundry'], rules: ['clean-up-after-yourself'],
      maxOccupants: 2, smokingAllowed: true, householdSleepSchedule: SleepSchedule.NIGHT_OWL, householdCleanliness: 2,
      photos: ['1560185893-a55cbc8c57e8', '1600607687939-ce8a6c25118c'],
    },
  ];

  const listings = [];
  for (const { photos, ...data } of listingsData) {
    listings.push(
      await prisma.listing.create({
        data: {
          ...data,
          photos: { create: photos.map((id, i) => ({ url: img(id), altText: `${data.title} — photo ${i + 1}`, order: i })) },
        },
      }),
    );
  }
  console.log(`  ✓ ${listings.length} listings with photos`);

  // ── Interests, conversation, messages ──
  const accepted = await prisma.interestRequest.create({
    data: {
      tenantId: amit!.id, listingId: listings[0]!.id, status: InterestStatus.ACCEPTED, resolvedAt: fromToday(-2),
      message: 'Hi! I work from home as a software engineer and am looking for a quiet, clean place. Could I visit this weekend?',
    },
  });
  const conversation = await prisma.conversation.create({ data: { interestRequestId: accepted.id } });
  const t = (h: number, m: number) => {
    const d = fromToday(-2);
    d.setUTCHours(h, m);
    return d;
  };
  await prisma.chatMessage.createMany({
    data: [
      { conversationId: conversation.id, senderId: priya!.id, content: 'Hi Amit! Thanks for reaching out. The room is free to view this weekend — what time suits you?', createdAt: t(4, 30), readAt: t(5, 0) },
      { conversationId: conversation.id, senderId: amit!.id, content: 'Saturday around 11 AM would be great, if that works for you.', createdAt: t(5, 15), readAt: t(5, 30) },
      { conversationId: conversation.id, senderId: priya!.id, content: 'Saturday 11 AM works. I’ll share the exact location closer to the day.', createdAt: t(5, 45) },
    ],
  });

  await prisma.interestRequest.createMany({
    data: [
      { tenantId: sneha!.id, listingId: listings[4]!.id, status: InterestStatus.PENDING, message: 'This room looks perfect for my commute to ITPL. Is it still available?' },
      { tenantId: vikram!.id, listingId: listings[7]!.id, status: InterestStatus.PENDING, message: 'I am a masters student at DU — this location is ideal. Is the room available next month?' },
      { tenantId: meera!.id, listingId: listings[1]!.id, status: InterestStatus.DECLINED, resolvedAt: fromToday(-1), message: 'Beautiful apartment! I have a small dog — would that be okay?' },
    ],
  });

  await prisma.savedListing.createMany({
    data: [
      { userId: amit!.id, listingId: listings[2]!.id },
      { userId: meera!.id, listingId: listings[3]!.id },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { userId: rajesh!.id, type: NotificationType.INTEREST_RECEIVED, title: 'New interest request', message: 'Sneha Reddy is interested in “Room next to Whitefield tech parks”.', metadata: { listingId: listings[4]!.id } },
      { userId: anita!.id, type: NotificationType.INTEREST_RECEIVED, title: 'New interest request', message: 'Vikram Singh is interested in “Student-friendly room near Delhi University”.', metadata: { listingId: listings[7]!.id } },
      { userId: amit!.id, type: NotificationType.INTEREST_ACCEPTED, title: 'Your request was accepted', message: 'The owner of “Sunlit single room near Andheri metro” accepted your request. You can now chat.', read: true, metadata: { listingId: listings[0]!.id, conversationId: conversation.id } },
      { userId: meera!.id, type: NotificationType.INTEREST_DECLINED, title: 'Your request was declined', message: 'The owner of “Spacious double room with sea view, Bandra” declined your request.', metadata: { listingId: listings[1]!.id } },
    ],
  });
  console.log('  ✓ interests, 1 conversation, saved listings, notifications');

  console.log(`\n🎉 Done. All demo accounts use the password: ${DEMO_PASSWORD}`);
  console.log('   Tenant: amit.patel@email.com   Owner: priya.sharma@email.com   Admin: admin@rentfinder.com\n');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
