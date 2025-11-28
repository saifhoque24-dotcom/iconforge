import { NextResponse } from 'next/server';
import { completeTransaction, addCredits, getUserByEmail } from '@/lib/db';
import { sql } from '@vercel/postgres';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { event, order } = body;

        // Verify webhook signature (in production, you should verify this)
        // For now, we'll process the webhook directly

        if (event === 'ORDER_COMPLETED' && order?.id) {
            // Get transaction from database
            const transactionResult = await sql`
        SELECT * FROM transactions WHERE revolut_order_id = ${order.id}
      `;

            const transaction = transactionResult.rows[0];
            if (!transaction) {
                return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
            }

            // Update transaction status
            await completeTransaction(order.id);

            // Add credits to user
            await addCredits(transaction.user_id, transaction.credits_purchased);

            console.log(`Added ${transaction.credits_purchased} credits to user ${transaction.user_id}`);
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error('Webhook error:', error);
        return NextResponse.json({
            error: error?.message || 'Webhook processing failed'
        }, { status: 500 });
    }
}
