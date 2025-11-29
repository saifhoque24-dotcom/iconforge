import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
    try {
        // Add is_favorite column to icons table
        await sql`
            ALTER TABLE icons 
            ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;
        `;

        return NextResponse.json({
            success: true,
            message: 'Added is_favorite column to icons table'
        });
    } catch (error: any) {
        console.error('Migration error:', error);
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}
