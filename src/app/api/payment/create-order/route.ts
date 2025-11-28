import { NextResponse } from 'next/server';
import { getOrCreateUser, createTransaction } from '@/lib/db';

const PACKAGES = {
    starter: { credits: 10, price: 5.00 },
    popular: { credits: 50, price: 20.00 },
    pro: { credits: 100, price: 35.00 },
};

export async function POST(req: Request) {
    try {
        const { email, packageType } = await req.json();

        if (!email || !packageType || !PACKAGES[packageType as keyof typeof PACKAGES]) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const pkg = PACKAGES[packageType as keyof typeof PACKAGES];
        const user = await getOrCreateUser(email);

        // Create order with Revolut
        const revolutApiKey = process.env.REVOLUT_API_KEY;
        if (!revolutApiKey) {
            return NextResponse.json({ error: 'Payment system not configured' }, { status: 500 });
        }

        const orderResponse = await fetch('https://merchant.revolut.com/api/1.0/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${revolutApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: Math.round(pkg.price * 100), // Convert to cents
                currency: 'USD',
                description: `${pkg.credits} IconForge Credits`,
                customer_email: email,
                merchant_order_ext_ref: `${user.id}-${Date.now()}`,
            }),
        });

        if (!orderResponse.ok) {
            const error = await orderResponse.text();
            console.error('Revolut API error:', error);
            return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
        }

        const orderData = await orderResponse.json();

        // Save transaction to database
        await createTransaction(user.id, orderData.id, pkg.price, pkg.credits);

        return NextResponse.json({
            publicId: orderData.public_id,
            orderId: orderData.id,
        });
    } catch (error: any) {
        console.error('Error creating order:', error);
        return NextResponse.json({
            error: error?.message || 'Failed to create order'
        }, { status: 500 });
    }
}
