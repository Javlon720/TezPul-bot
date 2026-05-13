import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'secret',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
      database: process.env.DB_NAME || 'tezpul'
    };

export const dbConfig = new Pool(poolConfig);
export const query = (text, params) => dbConfig.query(text, params);
