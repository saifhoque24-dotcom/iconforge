
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
1. KNOWN ENTITIES (FLAGS/LOGOS): If the user asks for a specific flag (e.g., UAE, USA), you MUST describe its EXACT layout.
   - UAE Flag: "Official Flag of United Arab Emirates, Red vertical band on hoist (left), Green (top), White (middle), Black (bottom) horizontal bands."
2. PRESERVE EXACT DETAILS: If the user specifies a color, object, or style, you MUST include it exactly.
3. INNOVATE SURROUNDINGS: You can innovate on the *style* (glass, 3D, vector) or *background*, but NEVER change the core symbol/flag.
4. NO HALLUCINATIONS: Do not add objects or concepts not implied by the user.
5. FORMAT: Output ONLY the raw prompt string.

Examples:
Input: "UAE Flag"
Output: App icon, Official Flag of United Arab Emirates, Red vertical band on left, Green top band, White middle band, Black bottom band, correct colors, flat vector style, white background.

Input: "Red cat"
Output: App icon, red cat, innovative geometric style, dynamic lighting, vibrant red, translucent glass elements, high quality, white background.

Input: "${prompt}"
Output: [/INST]`;

            const researchResponse = await client.textGeneration({
                model: 'mistralai/Mistral-7B-Instruct-v0.2',
                inputs: researchPrompt,
                parameters: {
                    max_new_tokens: 150,
                    temperature: 0.2, // Lower temperature for accuracy
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
1. KNOWN ENTITIES: If the user asks for a specific flag or symbol, describe its EXACT colors and layout. DO NOT change it.
2. PRESERVE EXACT DETAILS: If the user specifies a color, object, or style, you MUST include it exactly.
3. INNOVATE STYLE ONLY: Infuse the design with modern aesthetics but keep the core subject accurate.
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
        const isFlag = enhancedPrompt.toLowerCase().includes('flag');

        try {
            if (isFlag) {
                console.log('Flag detected, prioritizing FLUX for accuracy');
                // Priority 1 (Flags): FLUX.1-schnell (Better at spatial adherence/geometry)
                response = await client.textToImage({
                    model: 'black-forest-labs/FLUX.1-schnell',
                    inputs: enhancedPrompt,
                });
            } else {
                // Priority 1 (General): SDXL (Best Artistic Quality)
                response = await client.textToImage({
                    model: 'stabilityai/stable-diffusion-xl-base-1.0',
                    inputs: enhancedPrompt,
                });
            }
        } catch (primaryError) {
            console.error('Primary model failed, trying fallback:', primaryError);
            try {
                // Priority 2: Swap models based on what failed
                const fallbackModel = isFlag ? 'stabilityai/stable-diffusion-xl-base-1.0' : 'black-forest-labs/FLUX.1-schnell';
                response = await client.textToImage({
                    model: fallbackModel,
                    inputs: enhancedPrompt,
                });
            } catch (secondaryError) {
                console.error('Secondary model failed, trying SDXL-Lightning:', secondaryError);
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
                        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}`;
                        const pollRes = await fetch(pollinationsUrl);
                        if (!pollRes.ok) throw new Error('Pollinations.ai failed');
                        const pollBuffer = await pollRes.arrayBuffer();
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
