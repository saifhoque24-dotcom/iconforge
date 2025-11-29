import { NextResponse } from 'next/server';
import { getUserByEmail, getUserIcons, deleteIcon } from '@/lib/db';

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
        const { iconId, email } = await req.json();

        if (!iconId || !email) {
            return NextResponse.json({ error: 'Icon ID and email required' }, { status: 400 });
        }

        const user = await getUserByEmail(email);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        await deleteIcon(iconId, user.id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting icon:', error);
        return NextResponse.json({
            error: error?.message || 'Failed to delete icon'
        }, { status: 500 });
    }
}
