import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const dbConfig = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'secret',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  database: process.env.DB_NAME || 'tezpul',
});

// Helper function for quick queries
export const query = (text, params) => dbConfig.query(text, params);
