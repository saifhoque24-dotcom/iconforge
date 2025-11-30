import { NextResponse } from 'next/server';
import { InferenceClient } from '@huggingface/inference';
import { getUserByEmail, saveIcon, getRecentFavorites } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { prompt, email, seed } = await req.json();

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

        // Hardcoded descriptions for difficult flags to ensure 100% accuracy
        const FLAG_MAP: Record<string, { prompt: string, message: string }> = {
            'uae': {
                prompt: 'Official Flag of United Arab Emirates, Red vertical band on hoist (left), Green (top), White (middle), Black (bottom) horizontal bands, flat vector, 2d, white background',
                message: "I've crafted a precise vector of the UAE flag for you, keeping the official colors and layout exactly right! 🇦🇪"
            },
            'united arab emirates': {
                prompt: 'Official Flag of United Arab Emirates, Red vertical band on hoist (left), Green (top), White (middle), Black (bottom) horizontal bands, flat vector, 2d, white background',
                message: "I've crafted a precise vector of the UAE flag for you, keeping the official colors and layout exactly right! 🇦🇪"
            },
            'usa': {
                prompt: 'Flag of United States, Stars and Stripes, Red and White horizontal stripes, Blue canton with white stars in top left, flat vector, 2d',
                message: "Here's the Star-Spangled Banner! I made sure the stripes and stars are perfectly aligned for a classic look. 🇺🇸"
            },
            'america': {
                prompt: 'Flag of United States, Stars and Stripes, Red and White horizontal stripes, Blue canton with white stars in top left, flat vector, 2d',
                message: "Here's the Star-Spangled Banner! I made sure the stripes and stars are perfectly aligned for a classic look. 🇺🇸"
            },
            'uk': {
                prompt: 'Union Jack Flag, United Kingdom, Red Cross of St George, Saltire of St Andrew, Saltire of St Patrick, correct layout, flat vector, 2d',
                message: "I've generated a crisp Union Jack for you, ensuring all the crosses are correctly positioned. Cheers! 🇬🇧"
            },
        };

        // Step 1: "Research" and Expand Prompt
        let enhancedPrompt = prompt;
        let engagementMessage = '';
        const lowerPrompt = prompt.toLowerCase();
        const isFlag = lowerPrompt.includes('flag');

        // Check for specific hardcoded flags first
        let specificFlagMatch = false;
        for (const [key, value] of Object.entries(FLAG_MAP)) {
            if (lowerPrompt.includes(key)) {
                enhancedPrompt = value.prompt;
                engagementMessage = value.message;
                specificFlagMatch = true;
                break;
            }
        }

        // If not a specific hardcoded flag, use LLM
        if (!specificFlagMatch) {
            try {
                // Fetch user's recent favorites for context
                let userContext = "";
                if (email) {
                    const user = await getUserByEmail(email);
                    if (user) {
                        const favorites = await getRecentFavorites(user.id, 3);
                        if (favorites.length > 0) {
                            userContext = `\nUSER'S PAST FAVORITES (LEARN FROM THESE STYLES):\n- ${favorites.join('\n- ')}\n`;
                        }
                    }
                }

                // Add variation hint if seed is provided
                const variationHint = seed ? `\n\nVARIATION SEED: ${seed} (Use this to create a different variation of the design)` : '';

                // Construct a structured prompt for Mistral-7B-Instruct
                const researchPrompt = `[INST] You are a friendly, enthusiastic expert brand designer and logo specialist.
Your goal is to refine the user's request into a Stable Diffusion XL prompt AND write a warm, human-like message to the user explaining your design choice.

User Request: "${prompt}"
${userContext}${variationHint}
CRITICAL RULES:
1. TONE: Be warm, friendly, and enthusiastic! Use emojis if appropriate. Avoid robotic language.
2. PRESERVE EXACT DETAILS: If the user specifies a color, object, or style, you MUST include it exactly.
3. LEARN FROM FAVORITES: If "USER'S PAST FAVORITES" are provided above, try to match their general vibe/style (e.g., if they like flat vector, give them flat vector) UNLESS the user explicitly asks for something different.
4. VARIATION: If a VARIATION SEED is provided, create a DIFFERENT design variation (change angle, composition, style details) while keeping the core concept.
5. LOGO DETECTION: If the request mentions "logo", "brand", "business", or includes a business name (e.g., "Elite Cuts", "TechCo"), treat it as a PROFESSIONAL LOGO request.
6. LOGO GUIDELINES (when detected):
   - Include the business name in elegant, readable typography
   - Add "professional logo design" to the prompt
   - Specify "clean composition, balanced layout"
   - Include "vector style, scalable, professional branding"
   - Mention relevant industry symbols (e.g., scissors for barber, code for tech)
7. TYPOGRAPHY RULES (for logos):
   - Always specify: "bold elegant typography, readable text, professional font"
   - Include the exact business name in quotes in the prompt
   - Add "text integrated seamlessly with icon"
8. SPELLING ACCURACY (CRITICAL FOR LOGOS):
   - Extract the EXACT business name from the user's request letter-by-letter
   - In your prompt, write: "text spelling: [BUSINESS NAME]" to ensure correct letters
   - Example: For "Elite Cuts", write "text spelling: E-L-I-T-E C-U-T-S"
   - NEVER change, abbreviate, or misspell the business name
9. INNOVATE SURROUNDINGS: You can innovate on the *style* (glass, 3D, vector) or *background*, but NEVER change the core symbol/flag.
10. ENGAGE: Write a 1-sentence friendly message to the user explaining why this design works.
11. FORMAT: 
   Message: [Your warm message here]
   Prompt: [Raw prompt string here]

Examples:
Input: "Red cat"
Output: 
Message: I went with a super cute geometric glass style for your red cat to give it a modern, friendly vibe! 🐱✨
Prompt: App icon, red cat, innovative geometric style, dynamic lighting, vibrant red, translucent glass elements, high quality, white background.

Input: "Blue rocket"
Output: 
Message: Blast off! 🚀 I designed a sleek, flat blue rocket that will look amazing on any home screen.
Prompt: App icon, blue rocket, flat vector style, minimal, vibrant blue, white background, high quality.

Input: "create a barber shop logo for Elite Cuts"
Output:
Message: I've designed a sharp, professional logo for Elite Cuts with classic barber elements and bold typography! ✂️💈
Prompt: Professional logo design for "Elite Cuts" barber shop, text spelling: E-L-I-T-E C-U-T-S, vintage scissors and comb icon, bold elegant typography, readable text, black and gold color scheme, clean composition, balanced layout, vector style, scalable, professional branding, white background, high quality.

Input: "${prompt}"
Output: [/INST]`;

                const researchResponse = await client.textGeneration({
                    model: 'mistralai/Mistral-7B-Instruct-v0.2',
                    inputs: researchPrompt,
                    parameters: {
                        max_new_tokens: 200,
                        temperature: 0.7, // Slightly higher for more creativity/warmth
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
                enhancedPrompt = `Professional app icon design: ${prompt}. Style: Modern, clean, minimalist vector icon.`;
                engagementMessage = "I've whipped up a clean, professional design just for you! Hope you like it. ✨";
            }
        }

        // Ensure we always have a message
        if (!engagementMessage) {
            engagementMessage = "Here's a custom icon design I made just for you! Let me know what you think.";
        }

        // Step 2: Generate Image
        let response;

        try {
            if (isFlag || specificFlagMatch) {
                console.log('Flag detected, prioritizing Pollinations.ai for accuracy');
                // Priority 1 (Flags): Pollinations.ai with high quality settings
                const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&enhance=true`;
                const pollRes = await fetch(pollinationsUrl);
                if (!pollRes.ok) throw new Error('Pollinations.ai failed');
                const pollBuffer = await pollRes.arrayBuffer();
                response = new Blob([pollBuffer]);
            } else {
                // Priority 1 (General): SDXL (Best Artistic Quality) with quality parameters
                response = await client.textToImage({
                    model: 'stabilityai/stable-diffusion-xl-base-1.0',
                    inputs: enhancedPrompt,
                    parameters: {
                        guidance_scale: 7.5,
                        num_inference_steps: 30,
                    }
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
                        // Priority 5: Pollinations.ai (Guaranteed Fallback) with high quality
                        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&enhance=true`;
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
