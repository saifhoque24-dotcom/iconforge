import { NextResponse } from 'next/server';
import { InferenceClient } from '@huggingface/inference';
import { getUserByEmail, saveIcon } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { prompt, email, style = 'modern', color = 'vibrant', size = '1024' } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const apiKey = process.env.HUGGINGFACE_API_KEY?.trim();
        if (!apiKey) {
            return NextResponse.json({ error: 'Hugging Face API key not configured' }, { status: 500 });
        }

        const client = new InferenceClient(apiKey);

        // Color palette descriptions
        const colorDescriptions: Record<string, string> = {
            vibrant: 'vibrant, bold colors with high saturation (reds, blues, teals)',
            pastel: 'soft pastel colors (light pink, mint green, baby blue)',
            dark: 'dark, muted colors (navy, charcoal, slate gray)',
            monochrome: 'black, white, and shades of gray only',
        };

        // Style-specific prompts with color integration
        const stylePrompts: Record<string, string> = {
            modern: `Professional app icon design: ${prompt}. 
Style: Modern, clean, minimalist vector icon with smooth edges and perfect symmetry.
Quality: Ultra high-definition, crisp details, professional grade.
Design: Centered composition, balanced proportions, subtle depth with soft shadows.
Colors: ${colorDescriptions[color]}, harmonious palette, slight gradients for depth.
Background: Pure white (#FFFFFF) or subtle light gradient.
Format: Square aspect ratio, ${size}x${size} pixels, suitable for app stores and websites.
Details: Polished, premium quality, production-ready icon design.`,

            flat: `Flat design icon: ${prompt}.
Style: Pure flat design, no gradients, no shadows, completely 2D.
Colors: ${colorDescriptions[color]}, bold and solid with high contrast.
Design: Simple geometric shapes, minimal details, clean lines.
Background: Pure white.
Format: ${size}x${size} pixels, vector-style, perfect for modern UI.`,

            '3d': `3D icon design: ${prompt}.
Style: Three-dimensional with depth, realistic lighting and shadows.
Quality: High-quality 3D render with smooth surfaces.
Design: Isometric or perspective view, detailed textures.
Colors: ${colorDescriptions[color]}, rich tones with highlights and shadows.
Background: White with subtle shadow beneath icon.
Format: ${size}x${size} pixels, polished 3D asset.`,

            gradient: `Gradient icon: ${prompt}.
Style: Modern gradient design with smooth color transitions.
Colors: ${colorDescriptions[color]}, vibrant gradient overlays, multiple color blends.
Design: Sleek, contemporary, eye-catching.
Background: White or complementary gradient background.
Format: ${size}x${size} pixels, trendy, Instagram-style aesthetic.`,

            minimal: `Minimalist icon: ${prompt}.
Style: Ultra-minimal, essential elements only.
Colors: ${colorDescriptions[color]}, very limited palette.
Design: Simple lines, negative space, zen aesthetic.
Background: Pure white.
Format: ${size}x${size} pixels, clean, timeless, Apple-style minimalism.`,
        };

        // Use FLUX.1-schnell (free and fast)
        const response = await client.textToImage({
            model: 'black-forest-labs/FLUX.1-schnell',
            inputs: stylePrompts[style] || stylePrompts.modern,
        });

        // The SDK returns a Blob
        const buffer = await (response as unknown as Blob).arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');

        // Save to database
        const user = await getUserByEmail(email);
        if (user) {
            await saveIcon(user.id, prompt, base64Image);
        }

        return NextResponse.json({ image: base64Image });
    } catch (error: any) {
        console.error('Error generating icon:', error);
        return NextResponse.json({
            error: error?.message || 'Failed to generate icon',
            details: error?.toString()
        }, { status: 500 });
    }
}
