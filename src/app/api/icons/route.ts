import { NextResponse } from 'next/server';
import { getUserByEmail, getUserIcons, deleteIcon, toggleFavorite } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json({ error: 'Email required' }, { status: 400 });
        }

        const user = await getUserByEmail(email);
        if (!user) {
            return NextResponse.json({ icons: [] });
        }

        const icons = await getUserIcons(user.id);
        return NextResponse.json({ icons });
    } catch (error: any) {
        console.error('Error fetching icons:', error);
        return NextResponse.json({
            error: error?.message || 'Failed to fetch icons'
        }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const email = searchParams.get('email');

        if (!id || !email) {
            return NextResponse.json({ error: 'Missing id or email' }, { status: 400 });
        }

        const user = await getUserByEmail(email);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        await deleteIcon(parseInt(id), user.id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { id, email } = await req.json();

        if (!id || !email) {
            return NextResponse.json({ error: 'Missing id or email' }, { status: 400 });
        }

        const user = await getUserByEmail(email);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const isFavorite = await toggleFavorite(id, user.id);

        return NextResponse.json({ success: true, isFavorite });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
