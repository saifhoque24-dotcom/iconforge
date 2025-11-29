import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
        }

        const openai = new OpenAI({ apiKey });

        const response = await openai.images.generate({
            model: 'dall-e-3',
            prompt: `A professional, high-quality vector icon of ${prompt}. Flat design, minimal, solid colors, white background, simple and clean.`,
            n: 1,
            size: '1024x1024',
            response_format: 'b64_json',
        });

        const imageData = response.data[0]?.b64_json;
        if (!imageData) {
            return NextResponse.json({ error: 'No image generated' }, { status: 500 });
        }

        return NextResponse.json({ image: imageData });
    } catch (error: any) {
        console.error('Error generating icon:', error);
        return NextResponse.json({
            error: error?.message || 'Failed to generate icon'
        }, { status: 500 });
    }
}
