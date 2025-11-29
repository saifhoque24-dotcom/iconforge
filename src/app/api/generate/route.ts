import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: `A professional, high-quality vector icon of ${prompt}. Flat design, minimal, solid colors, white background.`,
            config: {
                numberOfImages: 1,
            },
        });

        const generatedImage = response.generatedImages?.[0];
        if (!generatedImage?.image?.imageBytes) {
            return NextResponse.json({ error: 'No image generated' }, { status: 500 });
        }

        return NextResponse.json({ image: generatedImage.image.imageBytes });
    } catch (error: any) {
        console.error('Error generating icon:', error);
        return NextResponse.json({
            error: error?.message || 'Failed to generate icon'
        }, { status: 500 });
    }
}
