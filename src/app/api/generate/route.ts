
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
            // Construct a structured prompt for Mistral-7B-Instruct
            // We use [INST] tags which are standard for this model family
            const researchPrompt = `[INST] You are an expert prompt engineer.
Your goal is to refine the user's request into a Stable Diffusion XL prompt.

User Request: "${prompt}"

CRITICAL RULES:
1. PRESERVE EXACT DETAILS: If the user specifies a color, object, or style, you MUST include it exactly.
2. NO HALLUCINATIONS: Do not add objects or concepts not implied by the user.
3. ENHANCE QUALITY, NOT CONTENT: Add keywords like "high quality", "professional", "app icon" ONLY if they don't contradict the user.
4. FORMAT: Output ONLY the raw prompt string. No "Here is the prompt" or quotes.

Examples:
Input: "Red cat"
Output: App icon, red cat, high quality, professional design, white background.

Input: "3D gold coin for crypto app"
Output: App icon, 3D gold coin, crypto theme, shiny, realistic lighting, high resolution, white background.

Input: "${prompt}"
Output: [/INST]`;

            const researchResponse = await client.textGeneration({
                model: 'mistralai/Mistral-7B-Instruct-v0.2',
                inputs: researchPrompt,
                parameters: {
                    max_new_tokens: 150,
                    temperature: 0.3, // Lower temperature for more deterministic/focused output
                    return_full_text: false,
                }
            });

            if (researchResponse.generated_text) {
                enhancedPrompt = researchResponse.generated_text.trim();
                console.log('AI Researched Prompt:', enhancedPrompt);
            }
        } catch (researchError) {
            console.error('Research step failed, falling back to template:', researchError);
            // Try Zephyr-7b-beta (often reliable free tier)
            try {
                const researchPrompt = `<|system|>
You are an expert prompt engineer.
Refine the user's request into a Stable Diffusion XL prompt.
CRITICAL RULES:
1. PRESERVE EXACT DETAILS: If the user specifies a color, object, or style, you MUST include it exactly.
2. NO HALLUCINATIONS: Do not add objects or concepts not implied by the user.
3. ENHANCE QUALITY, NOT CONTENT: Add keywords like "high quality", "professional", "app icon" ONLY if they don't contradict the user.
4. FORMAT: Output ONLY the raw prompt string.
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
                }
            } catch (zephyrError) {
                // Fallback to template
                enhancedPrompt = `Professional app icon design: ${prompt}. 
Style: Modern, clean, minimalist vector icon with smooth edges and perfect symmetry.
Quality: Ultra high-definition, crisp details, professional grade.
Design: Centered composition, balanced proportions, subtle depth with soft shadows.
Background: Pure white (#FFFFFF) or subtle light gradient.
Format: Square aspect ratio, suitable for app stores and websites.
Details: Polished, premium quality, production-ready icon design.`;
            }
        }

        // Step 2: Generate Image
        let response;
        try {
            // Priority 1: SDXL (Best Quality)
            response = await client.textToImage({
                model: 'stabilityai/stable-diffusion-xl-base-1.0',
                inputs: enhancedPrompt,
            });
        } catch (sdxlError) {
            console.error('SDXL failed, trying FLUX:', sdxlError);
            try {
                // Priority 2: FLUX.1-schnell (Fast & Free)
                response = await client.textToImage({
                    model: 'black-forest-labs/FLUX.1-schnell',
                    inputs: enhancedPrompt,
                });
            } catch (fluxError) {
                console.error('FLUX failed, trying SDXL-Lightning:', fluxError);
                try {
                    // Priority 3: SDXL-Lightning (ByteDance - Fast)
                    response = await client.textToImage({
                        model: 'ByteDance/SDXL-Lightning',
                        inputs: enhancedPrompt,
                    });
                } catch (lightningError) {
                    console.error('Lightning failed, trying OpenJourney:', lightningError);
                    try {
                        // Priority 4: OpenJourney (Midjourney style - Reliable)
                        response = await client.textToImage({
                            model: 'prompthero/openjourney',
                            inputs: enhancedPrompt,
                        });
                    } catch (ojError) {
                        console.error('OpenJourney failed, using Pollinations.ai (Nuclear Option):', ojError);
                        // Priority 5: Pollinations.ai (Guaranteed Fallback)
                        // This API is free, unlimited, and doesn't use HF Inference Client
                        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}`;
                        const pollRes = await fetch(pollinationsUrl);
                        if (!pollRes.ok) throw new Error('Pollinations.ai failed');
                        const pollBuffer = await pollRes.arrayBuffer();
                        // Mock the response object expected by the next step
                        response = new Blob([pollBuffer]);
                    }
                }
            }
        }

        // Handle both HF response (Blob) and Pollinations response (Blob)
        let buffer;
        if (response instanceof Blob) {
            buffer = await response.arrayBuffer();
        } else {
            // HF Inference Client returns a specific object that acts like a Blob but might need casting
            buffer = await (response as unknown as Blob).arrayBuffer();
        }

        const base64Image = Buffer.from(buffer).toString('base64');

        // Save to database
        const user = await getUserByEmail(email);
        if (user) {
            await saveIcon(user.id, prompt, base64Image);
        }

        return NextResponse.json({ image: base64Image });
    } catch (error: any) {
        console.error('Error generating icon:', error);

        // Check for rate limit errors specifically
        const errorMessage = error?.message || '';
        if (errorMessage.includes('rate limit') || errorMessage.includes('usage limit')) {
            return NextResponse.json({
                error: 'High traffic - please try again in a few seconds.',
                details: 'Our AI servers are currently busy.'
            }, { status: 503 });
        }

        return NextResponse.json({
            error: 'Failed to generate icon',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}
