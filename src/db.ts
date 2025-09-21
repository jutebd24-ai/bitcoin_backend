import 'dotenv/config';

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "./schema.js";

neonConfig.webSocketConstructor = ws;

// Optional database connection - fallback to memory storage if not available
let pool: Pool | null = null;
let db: any = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema });
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.log('⚠️ Database connection failed, using memory storage');
  }
} else {
  console.log('⚠️ No DATABASE_URL provided - using memory storage for testing');
}

export { pool, db };
