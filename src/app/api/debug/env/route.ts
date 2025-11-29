import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

export async function GET() {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ status: 'error', message: 'API Key is missing' });
    }

    const firstChar = apiKey.substring(0, 3);
    const lastChar = apiKey.substring(apiKey.length - 3);
    const length = apiKey.length;

    try {
        const hf = new HfInference(apiKey);
        // Try a very cheap/fast call to verify auth
        await hf.textToImage({
            model: 'stabilityai/stable-diffusion-2-1',
            inputs: 'test',
            parameters: { num_inference_steps: 1 }
        });

        return NextResponse.json({
            status: 'success',
            keyDebug: `${firstChar}...${lastChar} (Length: ${length})`,
            message: 'API Key is valid and working!'
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            keyDebug: `${firstChar}...${lastChar} (Length: ${length})`,
            message: error.message,
            details: error.toString()
        }, { status: 500 });
    }
}
