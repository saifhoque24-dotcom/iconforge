import { NextResponse } from 'next/server';

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

        // Use Stable Diffusion via Hugging Face Inference API (FREE!)
        const response = await fetch(
            'https://router.huggingface.co/models/stabilityai/stable-diffusion-2-1',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: `professional vector icon of ${prompt}, flat design, minimal, solid colors, white background, simple clean icon style`,
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('Hugging Face API error:', error);
            return NextResponse.json({
                error: 'Failed to generate image',
                details: error,
                status: response.status
            }, { status: 500 });
        }

        // Convert response to base64
        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');

        return NextResponse.json({ image: base64Image });
    } catch (error: any) {
        console.error('Error generating icon:', error);
        return NextResponse.json({
            error: error?.message || 'Failed to generate icon'
        }, { status: 500 });
    }
}
