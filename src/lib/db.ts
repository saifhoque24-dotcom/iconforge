import { sql } from '@vercel/postgres';

export async function getOrCreateUser(email: string) {
    const result = await sql`
    INSERT INTO users (email, credits)
    VALUES (${email}, 0)
    ON CONFLICT (email) 
    DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
    return result.rows[0];
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

export async function logUsage(userId: number, prompt: string) {
    await sql`
    INSERT INTO usage (user_id, prompt)
    VALUES (${userId}, ${prompt})
  `;
}
