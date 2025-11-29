```typescript
import { sql } from '@vercel/postgres';

// Auto-initialize database tables
async function initDB() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users(
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  credits INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
    await sql`
      CREATE TABLE IF NOT EXISTS transactions(
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
      CREATE TABLE IF NOT EXISTS usage(
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  prompt TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
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
  const result = await sql`
    INSERT INTO users(email, credits)
VALUES(${ email }, 0)
    ON CONFLICT(email) 
    DO UPDATE SET updated_at = CURRENT_TIMESTAMP
RETURNING *
  `;
  return result.rows[0];
}

export async function getUserByEmail(email: string) {
    const result = await sql`
SELECT * FROM users WHERE email = ${ email }
`;
    return result.rows[0];
}

export async function addCredits(userId: number, credits: number) {
    const result = await sql`
    UPDATE users 
    SET credits = credits + ${ credits }, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${ userId }
RETURNING *
  `;
    return result.rows[0];
}

export async function deductCredit(userId: number) {
    const result = await sql`
    UPDATE users 
    SET credits = credits - 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${ userId } AND credits > 0
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
    INSERT INTO transactions(user_id, revolut_order_id, amount, credits_purchased, status)
VALUES(${ userId }, ${ revolutOrderId }, ${ amount }, ${ creditsPurchased }, 'pending')
RETURNING *
  `;
    return result.rows[0];
}

export async function completeTransaction(revolutOrderId: string) {
    const result = await sql`
    UPDATE transactions 
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP
    WHERE revolut_order_id = ${ revolutOrderId }
RETURNING *
  `;
    return result.rows[0];
}

export async function logUsage(userId: number, prompt: string) {
    await sql`
    INSERT INTO usage(user_id, prompt)
VALUES(${ userId }, ${ prompt })
  `;
}
