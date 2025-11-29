import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

export async function POST(req: Request) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = process.env.HUGGINGFACE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Hugging Face API key not configured' }, { status: 500 });
        }

        const hf = new HfInference(apiKey);

        // Use Stable Diffusion 2.1
        const response = await hf.textToImage({
            model: 'stabilityai/stable-diffusion-2-1',
            inputs: `professional vector icon of ${prompt}, flat design, minimal, solid colors, white background, simple clean icon style`,
            parameters: {
                negative_prompt: 'blur, fuzzy, low quality, text, watermark, complex, realistic, photo, 3d',
            }
        });

        // The SDK returns a Blob, but TypeScript might be confused. 
        // We can cast it or use arrayBuffer() if it exists.
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
