import { sql } from '@vercel/postgres';

// Run this once to fix existing database
async function migrate() {
  try {
    // Update existing users to have 5 credits if they have 0
    await sql`UPDATE users SET credits = 5 WHERE credits = 0`;

    // Alter table to change default (if supported by your DB)
    await sql`ALTER TABLE users ALTER COLUMN credits SET DEFAULT 5`;

    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Auto-initialize database tables
async function initDB() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        credits INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        revolut_order_id VARCHAR(255) UNIQUE,
        amount DECIMAL(10, 2),
        credits_purchased INTEGER,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        prompt TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS icons (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        prompt TEXT NOT NULL,
        image_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Run migration after tables exist
    await migrate();

    console.log('Database tables initialized');
  } catch (error) {
    console.error('Failed to init DB:', error);
  }
}

export async function getOrCreateUser(email: string) {
  // Try to create user, if it fails due to missing table, init DB and retry
  try {
    return await createUserInternal(email);
  } catch (error: any) {
    if (error.message?.includes('relation "users" does not exist')) {
      await initDB();
      return await createUserInternal(email);
    }
    throw error;
  }
}

async function createUserInternal(email: string) {
  // First, insert or get the user
  const result = await sql`
    INSERT INTO users (email)
    VALUES (${email})
    ON CONFLICT (email) 
    DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const user = result.rows[0];

  // If this is a new user (credits is 0), give them 5 credits
  if (user.credits === 0) {
    const updated = await sql`
      UPDATE users SET credits = 5 WHERE id = ${user.id} RETURNING *
    `;
    return updated.rows[0];
  }

  return user;
}

export async function getUserByEmail(email: string) {
  const result = await sql`
    SELECT * FROM users WHERE email = ${email}
  `;
  return result.rows[0];
}

export async function addCredits(userId: number, credits: number) {
  const result = await sql`
    UPDATE users 
    SET credits = credits + ${credits}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${userId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function deductCredit(userId: number) {
  const result = await sql`
    UPDATE users 
    SET credits = credits - 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${userId} AND credits > 0
    RETURNING *
  `;
  return result.rows[0];
}

export async function createTransaction(
  userId: number,
  revolutOrderId: string,
  amount: number,
  creditsPurchased: number
) {
  const result = await sql`
    INSERT INTO transactions (user_id, revolut_order_id, amount, credits_purchased, status)
    VALUES (${userId}, ${revolutOrderId}, ${amount}, ${creditsPurchased}, 'pending')
    RETURNING *
  `;
  return result.rows[0];
}

export async function completeTransaction(revolutOrderId: string) {
  const result = await sql`
    UPDATE transactions 
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP
    WHERE revolut_order_id = ${revolutOrderId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function saveIcon(userId: number, prompt: string, imageData: string) {
  const result = await sql`
    INSERT INTO icons (user_id, prompt, image_data)
    VALUES (${userId}, ${prompt}, ${imageData})
    RETURNING *
  `;
  return result.rows[0];
}

export async function getUserIcons(userId: number) {
  const result = await sql`
    SELECT * FROM icons 
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return result.rows;
}

export async function deleteIcon(iconId: number, userId: number) {
  const result = await sql`
    DELETE FROM icons 
    WHERE id = ${iconId} AND user_id = ${userId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function logUsage(userId: number, prompt: string) {
  await sql`
    INSERT INTO usage (user_id, prompt)
    VALUES (${userId}, ${prompt})
  `;
}
