import { NextResponse } from 'next/server';
import { InferenceClient } from '@huggingface/inference';

export async function POST(req: Request) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = process.env.HUGGINGFACE_API_KEY?.trim();
        if (!apiKey) {
            return NextResponse.json({ error: 'Hugging Face API key not configured' }, { status: 500 });
        }

        const client = new InferenceClient(apiKey);

        // Use FLUX.1-schnell (free and fast)
        const response = await client.textToImage({
            model: 'black-forest-labs/FLUX.1-schnell',
            inputs: `professional vector icon of ${prompt}, flat design, minimal, solid colors, white background, simple clean icon style`,
        });

        // The SDK returns a Blob
        const buffer = await (response as unknown as Blob).arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');

        return NextResponse.json({ image: base64Image });
    } catch (error: any) {
        console.error('Error generating icon:', error);
        return NextResponse.json({
            error: error?.message || 'Failed to generate icon',
            details: error?.toString()
        }, { status: 500 });
    }
}
