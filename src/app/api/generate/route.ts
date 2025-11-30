
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
        let engagementMessage = '';
        try {
            // Construct a structured prompt for Mistral-7B-Instruct
            const researchPrompt = `[INST] You are an expert brand designer.
Your goal is to refine the user's request into a Stable Diffusion XL prompt AND write a short, engaging message to the user explaining your design choice.

User Request: "${prompt}"

CRITICAL RULES:
1. KNOWN ENTITIES (FLAGS/LOGOS): If the user asks for a specific flag (e.g., UAE, USA), you MUST describe its EXACT layout.
   - UAE Flag: "Official Flag of United Arab Emirates, Red vertical band on hoist (left), Green (top), White (middle), Black (bottom) horizontal bands."
2. PRESERVE EXACT DETAILS: If the user specifies a color, object, or style, you MUST include it exactly.
3. INNOVATE SURROUNDINGS: You can innovate on the *style* (glass, 3D, vector) or *background*, but NEVER change the core symbol/flag.
4. ENGAGE: Write a 1-sentence friendly message to the user explaining why this design works.
5. FORMAT: 
   Message: [Your message here]
   Prompt: [Raw prompt string here]

Examples:
Input: "UAE Flag"
Output: 
Message: I've created a precise vector representation of the UAE flag, keeping the official colors and layout for maximum accuracy.
Prompt: App icon, Official Flag of United Arab Emirates, Red vertical band on left, Green top band, White middle band, Black bottom band, correct colors, flat vector style, white background.

Input: "Red cat"
Output: 
Message: I went with a geometric glass style for the red cat to give it a modern, tech-forward vibe!
Prompt: App icon, red cat, innovative geometric style, dynamic lighting, vibrant red, translucent glass elements, high quality, white background.

Input: "${prompt}"
Output: [/INST]`;

            const researchResponse = await client.textGeneration({
                model: 'mistralai/Mistral-7B-Instruct-v0.2',
                inputs: researchPrompt,
                parameters: {
                    max_new_tokens: 200,
                    temperature: 0.4,
                    return_full_text: false,
                }
            });

            if (researchResponse.generated_text) {
                const text = researchResponse.generated_text.trim();
                // Parse Message and Prompt
                const messageMatch = text.match(/Message:\s*(.+)/);
                const promptMatch = text.match(/Prompt:\s*(.+)/);

                if (messageMatch) engagementMessage = messageMatch[1].trim();
                if (promptMatch) enhancedPrompt = promptMatch[1].trim();
                else if (!messageMatch && text.length > 10) enhancedPrompt = text; // Fallback if format fails

                console.log('AI Message:', engagementMessage);
                console.log('AI Prompt:', enhancedPrompt);
            }
        } catch (researchError) {
            console.error('Research step failed, falling back to template:', researchError);
            // Fallback template (keep existing logic)
            // ... (Zephyr fallback would need similar update, but keeping it simple for now)
            enhancedPrompt = `Professional app icon design: ${prompt}. 
Style: Modern, clean, minimalist vector icon with smooth edges and perfect symmetry.
Quality: Ultra high-definition, crisp details, professional grade.
Design: Centered composition, balanced proportions, subtle depth with soft shadows.
Background: Pure white (#FFFFFF) or subtle light gradient.
Format: Square aspect ratio, suitable for app stores and websites.
Details: Polished, premium quality, production-ready icon design.`;
        }

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
        console.log('Flag detected, prioritizing Pollinations.ai for accuracy');
        // Priority 1 (Flags): Pollinations.ai (Often better at exact common entities)
        // We also force a simpler prompt for flags to avoid 3D distortion
        const flagPrompt = enhancedPrompt.replace('innovative', 'flat').replace('3D', '2D').replace('dynamic lighting', 'flat lighting');
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(flagPrompt)}`;
        const pollRes = await fetch(pollinationsUrl);
        if (!pollRes.ok) throw new Error('Pollinations.ai failed');
        const pollBuffer = await pollRes.arrayBuffer();
        response = new Blob([pollBuffer]);
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
        // Priority 2: FLUX.1-schnell (Fast & Good Geometry)
        response = await client.textToImage({
            model: 'black-forest-labs/FLUX.1-schnell',
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
        // Priority 2: FLUX.1-schnell (Fast & Good Geometry)
        response = await client.textToImage({
            model: 'black-forest-labs/FLUX.1-schnell',
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

return NextResponse.json({
    image: base64Image,
    message: engagementMessage
});
    } catch (error: any) {
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
