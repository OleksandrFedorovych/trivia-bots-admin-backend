/**
 * Database Connection and Setup
 * PostgreSQL database connection pool
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const { Pool, Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'trivia_bots',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT) || 5432,
};

console.log('dfdf:', dbConfig);

// Create pool with SSL for remote connections
const pool = new Pool({
  ...dbConfig,
  max: 20, // Maximum number of clients in the pool
  // idleTimeoutMillis: 30000,
  // connectionTimeoutMillis: 2000,
 // ssl: true,
 ssl: true,
});

/**
 * Ensure database exists, create if it doesn't
 * Connects to default 'postgres' database to create the target database
 */
export async function ensureDatabaseExists() {
  const targetDatabase = dbConfig.database;
  console.log('calling here?');

  // Skip if connecting to default postgres database
  if (targetDatabase === 'postgres') {
    console.log('✅ Using default postgres database');
    return;
  }

  // Connect to default 'postgres' database to check/create target database
  const adminClient = new Client({
    user: dbConfig.user,
    host: dbConfig.host,
    database: 'postgres', // Connect to default database
    password: dbConfig.password,
    port: dbConfig.port,
    ssl: process.env.DB_HOST && !process.env.DB_HOST.includes('localhost') ? { rejectUnauthorized: false } : false,
  });

  try {
    await adminClient.connect();
    console.log('🔌 Connected to postgres database to check for target database');

    // Check if database exists
    const result = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDatabase]
    );

    if (result.rows.length === 0) {
      // Database doesn't exist, create it
      console.log(`📦 Creating database: ${targetDatabase}`);
      await adminClient.query(`CREATE DATABASE "${targetDatabase}"`);
      console.log(`✅ Database ${targetDatabase} created successfully`);
    } else {
      console.log(`✅ Database ${targetDatabase} already exists`);
    }
  } catch (error) {
    // If error is "database does not exist" or permission error, log and continue
    if (error.message.includes('does not exist') || error.message.includes('permission')) {
      console.warn(`⚠️  Could not check/create database: ${error.message}`);
      console.warn('⚠️  Please ensure the database exists or user has CREATE DATABASE permission');
    } else {
      throw error;
    }
  } finally {
    await adminClient.end();
  }
}

// Test connection
pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {array} params - Query parameters
 * @returns {Promise} Query result
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error', { text, error: error.message });
    throw error;
  }
}

/**
 * Initialize database schema
 * Runs schema.sql to create tables and indexes
 */
export async function initDatabase() {
  try {
    // Ensure database exists first
    await ensureDatabaseExists();

    // Test connection to the target database
    try {
      await pool.query('SELECT NOW()');
      console.log('✅ Database connection established');
    } catch (connError) {
      console.error('❌ Cannot connect to database:', connError.message);
      throw connError;
    }

    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');

    // Remove comments and split into statements
    const statements = schema
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      })
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📋 Executing ${statements.length} schema statements...`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      if (statement) {
        try {
          await pool.query(statement);
          successCount++;
        } catch (err) {
          // Ignore "already exists" errors (tables/extensions/indexes)
          if (
            err.message.includes('already exists') ||
            err.message.includes('duplicate key value') ||
            err.code === '42P07' || // duplicate_table
            err.code === '42710'    // duplicate_object
          ) {
            skippedCount++;
          } else {
            errorCount++;
            console.warn(`⚠️  Schema statement error: ${err.message}`);
            console.warn(`   Statement: ${statement.substring(0, 100)}...`);
          }
        }
      }
    }

    console.log(`✅ Database schema initialized: ${successCount} executed, ${skippedCount} skipped (already exists), ${errorCount} errors`);

    if (errorCount > 0) {
      console.warn('⚠️  Some schema statements had errors. Please check the logs above.');
    }

    return true;
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

/**
 * Get database pool (for advanced use)
 */
export function getPool() {
  return pool;
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  await pool.end();
  console.log('Database connection closed');
}

export default pool;


