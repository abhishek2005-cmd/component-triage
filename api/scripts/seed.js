import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Part from '../src/models/Part.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const partsFile = new URL('../../data/parts.json', import.meta.url);

async function seedParts() {
  const { MONGODB_URI } = process.env;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required to seed the catalog');
  }

  const parts = JSON.parse(await readFile(partsFile, 'utf8'));

  if (!Array.isArray(parts)) {
    throw new Error('Catalog data must be a JSON array');
  }

  await mongoose.connect(MONGODB_URI);
  await Part.deleteMany({});
  const insertedParts = await Part.insertMany(parts);

  console.log(`Inserted ${insertedParts.length} parts into the catalog.`);
}

try {
  await seedParts();
} catch (error) {
  console.error(`Catalog seeding failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}