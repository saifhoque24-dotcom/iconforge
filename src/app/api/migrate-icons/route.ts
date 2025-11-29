import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
    try {
        // Create icons table
        await sql`
            CREATE TABLE IF NOT EXISTS icons (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                prompt TEXT NOT NULL,
                image_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        return NextResponse.json({
            success: true,
            message: 'Icons table created successfully!'
        });
    } catch (error: any) {
        console.error('Migration error:', error);
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}
