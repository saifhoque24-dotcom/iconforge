import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
    try {
        // Update all users with 0 credits to have 5 credits
        const updateResult = await sql`
      UPDATE users SET credits = 5 WHERE credits = 0
    `;

        // Try to alter the default (might fail if already set, that's okay)
        try {
            await sql`ALTER TABLE users ALTER COLUMN credits SET DEFAULT 5`;
        } catch (e) {
            console.log('Default already set or not supported');
        }

        return NextResponse.json({
            success: true,
            message: `Updated ${updateResult.rowCount} users to 5 credits`
        });
    } catch (error: any) {
        console.error('Migration error:', error);
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}
