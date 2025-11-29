
import { NextResponse } from 'next/server';
import { InferenceClient } from '@huggingface/inference';
import { getUserByEmail, saveIcon } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { prompt, email } = await req.json();

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

        // Step 1: "Research" and Expand Prompt using an LLM
        let enhancedPrompt = prompt;
        try {
            // Try Zephyr-7b-beta (often reliable free tier)
            const researchPrompt = `<|system|>
You are an expert prompt engineer for Stable Diffusion XL.
Your goal is to convert a user's request into a highly effective image generation prompt for an app icon.
Guidelines:
1. Keep the user's core idea exactly as is.
2. If they provide a name, suggest a lettermark or symbol representing it.
3. Add technical keywords: "vector", "minimalist", "professional", "smooth", "white background".
4. Do NOT add conversational text. Output ONLY the prompt.
</s>
<|user|>
${prompt}
</s>
<|assistant|>`;

            const researchResponse = await client.textGeneration({
                model: 'HuggingFaceH4/zephyr-7b-beta',
                inputs: researchPrompt,
                parameters: {
                    max_new_tokens: 150,
                    temperature: 0.3,
                    return_full_text: false,
                }
            });

            if (researchResponse.generated_text) {
                enhancedPrompt = researchResponse.generated_text.trim();
                console.log('AI Researched Prompt:', enhancedPrompt);
            }
        } catch (researchError) {
            console.error('Research step failed, falling back to template:', researchError);
            // Fallback to template
            enhancedPrompt = `Professional app icon design: ${prompt}. 
Style: Modern, clean, minimalist vector icon with smooth edges and perfect symmetry.
Quality: Ultra high-definition, crisp details, professional grade.
Design: Centered composition, balanced proportions, subtle depth with soft shadows.
Background: Pure white (#FFFFFF) or subtle light gradient.
Format: Square aspect ratio, suitable for app stores and websites.
Details: Polished, premium quality, production-ready icon design.`;
        }

        // Step 2: Generate Image
        let response;
        try {
            // Try SDXL first (Higher Quality)
            response = await client.textToImage({
                model: 'stabilityai/stable-diffusion-xl-base-1.0',
                inputs: enhancedPrompt,
            });
        } catch (sdxlError) {
            console.error('SDXL failed, falling back to FLUX:', sdxlError);
            // Fallback to FLUX.1-schnell (Fast & Free)
            response = await client.textToImage({
                model: 'black-forest-labs/FLUX.1-schnell',
                inputs: enhancedPrompt,
            });
        }

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
