import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
    try {
        // Get all users
        const users = await sql`SELECT * FROM users`;

        return NextResponse.json({
            users: users.rows,
            count: users.rowCount
        });
    } catch (error: any) {
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}
