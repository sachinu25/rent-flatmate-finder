import 'dotenv/config'; // Prisma skips .env loading when a config file exists.

import path from 'node:path';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  migrations: { seed: 'tsx prisma/seed.ts' },
});
