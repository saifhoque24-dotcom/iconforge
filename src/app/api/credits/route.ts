import { NextResponse } from 'next/server';
import { getUserByEmail, deductCredit } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json({ error: 'Email required' }, { status: 400 });
        }

        const user = await getUserByEmail(email);

        if (!user) {
            return NextResponse.json({ credits: 0 });
        }

        return NextResponse.json({ credits: user.credits });
    } catch (error: any) {
        console.error('Error fetching credits:', error);
        return NextResponse.json({
            error: error?.message || 'Failed to fetch credits'
        }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email required' }, { status: 400 });
        }

        const user = await getUserByEmail(email);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.credits <= 0) {
            return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
        }

        const updatedUser = await deductCredit(user.id);

        if (!updatedUser) {
            return NextResponse.json({ error: 'Failed to deduct credit' }, { status: 500 });
        }

        return NextResponse.json({ credits: updatedUser.credits });
    } catch (error: any) {
        console.error('Error deducting credit:', error);
        return NextResponse.json({
            error: error?.message || 'Failed to deduct credit'
        }, { status: 500 });
    }
}
