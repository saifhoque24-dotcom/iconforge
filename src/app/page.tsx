"use client";

import { useState, useEffect } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import IconDisplay from '@/components/IconDisplay';
import CreditBalance from '@/components/CreditBalance';
import PricingModal from '@/components/PricingModal';

declare global {
    interface Window {
        RevolutCheckout: any;
    }
}

export default function Home() {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [image, setImage] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [credits, setCredits] = useState(0);
    const [showPricing, setShowPricing] = useState(false);
    const [hasEmail, setHasEmail] = useState(false);

    useEffect(() => {
        // Load Revolut Checkout SDK
        const script = document.createElement('script');
        script.src = 'https://merchant.revolut.com/embed.js';
        script.async = true;
        document.body.appendChild(script);

        // Check for saved email
        const savedEmail = localStorage.getItem('userEmail');
        if (savedEmail) {
            setEmail(savedEmail);
            setHasEmail(true);
            fetchCredits(savedEmail);
        }

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const fetchCredits = async (userEmail: string) => {
        try {
            const res = await fetch(`/api/credits?email=${encodeURIComponent(userEmail)}`);
            const data = await res.json();
            setCredits(data.credits || 0);
        } catch (err) {
            console.error('Failed to fetch credits:', err);
        }
    };

    const handleEmailSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email.trim()) {
            localStorage.setItem('userEmail', email);
            setHasEmail(true);
            fetchCredits(email);
        }
    };

    const generateIcon = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        // Check credits
        if (credits <= 0) {
            setShowPricing(true);
            return;
        }

        setLoading(true);
        setError('');
        setImage(null);

        try {
            // Deduct credit first
            const creditRes = await fetch('/api/credits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!creditRes.ok) {
                if (creditRes.status === 402) {
                    setShowPricing(true);
                    return;
                }
                throw new Error('Failed to deduct credit');
            }

            const creditData = await creditRes.json();
            setCredits(creditData.credits);

            // Generate icon
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate icon');
            }

            setImage(data.image);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPackage = async (packageType: string) => {
        try {
            const res = await fetch('/api/payment/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, packageType }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create order');
            }

            // Initialize Revolut Checkout
            if (window.RevolutCheckout) {
                const instance = await window.RevolutCheckout(data.publicId, 'prod');
                await instance.payWithPopup({
                    onSuccess() {
                        setShowPricing(false);
                        fetchCredits(email);
                        alert('Payment successful! Credits added to your account.');
                    },
                    onError(error: any) {
                        console.error('Payment error:', error);
                        alert('Payment failed. Please try again.');
                    },
                });
            }
        } catch (err: any) {
            alert(err.message);
        }
    };

    if (!hasEmail) {
        return (
            <main className="min-h-screen bg-white text-black flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 font-bold text-3xl tracking-tight mb-4">
                            <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center text-white">
                                <Sparkles size={24} />
                            </div>
                            IconForge
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Welcome!</h1>
                        <p className="text-gray-500">Enter your email to get started with 5 free credits</p>
                    </div>

                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full p-4 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all shadow-sm text-lg"
                            required
                        />
                        <button
                            type="submit"
                            className="w-full bg-black text-white py-4 rounded-2xl font-medium hover:bg-gray-800 transition-colors"
                        >
                            Get Started
                        </button>
                    </form>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-white text-black selection:bg-gray-100">
            <nav className="border-b border-gray-100 p-4 sticky top-0 bg-white/80 backdrop-blur-md z-10">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
                            <Sparkles size={16} />
                        </div>
                        IconForge
                    </div>
                    <CreditBalance credits={credits} onBuyMore={() => setShowPricing(true)} />
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600">
                        Generate Professional Icons <br /> in Seconds.
                    </h1>
                    <p className="text-lg text-gray-500 max-w-xl mx-auto">
                        Describe your icon, and our AI will generate a high-quality, vector-style asset ready for your next project.
                    </p>
                </div>

                <div className="max-w-xl mx-auto">
                    <form onSubmit={generateIcon} className="relative mb-8 group">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., a blue rocket ship, flat style"
                            className="w-full p-4 pr-32 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all shadow-sm text-lg"
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !prompt.trim()}
                            className="absolute right-2 top-2 bottom-2 bg-black text-white px-6 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            {loading ? 'Generating...' : (
                                <>
                                    Generate <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>

                    {error && (
                        <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-xl text-sm text-center border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-center">
                        <IconDisplay image={image} loading={loading} />
                    </div>
                </div>

                <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                        <h3 className="font-bold mb-2">High Quality</h3>
                        <p className="text-sm text-gray-500">1024x1024 resolution PNGs ready for production.</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                        <h3 className="font-bold mb-2">Commercial Use</h3>
                        <p className="text-sm text-gray-500">Own the assets you generate completely.</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                        <h3 className="font-bold mb-2">Instant</h3>
                        <p className="text-sm text-gray-500">No waiting. Get your icons in seconds.</p>
                    </div>
                </div>
            </div>

            <PricingModal
                isOpen={showPricing}
                onClose={() => setShowPricing(false)}
                onSelectPackage={handleSelectPackage}
                userEmail={email}
            />
        </main>
    );
}
