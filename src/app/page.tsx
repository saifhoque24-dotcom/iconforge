"use client";

import { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Zap, Download, Shield, Star, CheckCircle } from 'lucide-react';
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
    const [aiMessage, setAiMessage] = useState('');
    const [email, setEmail] = useState('');
    const [credits, setCredits] = useState(0);
    const [showPricing, setShowPricing] = useState(false);
    const [hasEmail, setHasEmail] = useState(false);
    const [icons, setIcons] = useState<any[]>([]);
    const [showGallery, setShowGallery] = useState(false);

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

    const fetchIcons = async () => {
        try {
            const res = await fetch(`/api/icons?email=${encodeURIComponent(email)}`);
            const data = await res.json();
            setIcons(data.icons || []);
        } catch (err) {
            console.error('Failed to fetch icons:', err);
        }
    };



    const toggleFavorite = async (id: number) => {
        try {
            const res = await fetch('/api/icons', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, email: email }),
            });

            if (!res.ok) throw new Error('Failed to toggle favorite');

            const data = await res.json();

            setIcons(icons.map(icon =>
                icon.id === id ? { ...icon, is_favorite: data.isFavorite } : icon
            ));
        } catch (err) {
            console.error(err);
        }
    };

    const downloadIcon = (imageData: string, prompt: string) => {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${imageData}`;
        link.download = `${prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
        link.click();
    };

    const deleteIconHandler = async (iconId: number) => {
        try {
            await fetch('/api/icons', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ iconId, email }),
            });
            fetchIcons();
        } catch (err) {
            console.error('Failed to delete icon:', err);
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
        const creditsNeeded = 1;
        if (credits < creditsNeeded) {
            setShowPricing(true);
            return;
        }

        setLoading(true);
        setError('');
        setImage(null);
        setAiMessage('');

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
                body: JSON.stringify({ prompt, email }),
            });

            const data = await res.json();

            if (!res.ok) {
                const errorMessage = data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to generate icon');
                throw new Error(errorMessage);
            }

            setImage(data.image);
            if (data.message) setAiMessage(data.message);
            fetchIcons(); // Refresh gallery
        } catch (err: any) {
            setError(err.message);
            // If generation fails, refund credits
            await fetch('/api/credits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, credits: -creditsNeeded }), // Add back credits
            });
            setCredits(prevCredits => prevCredits + creditsNeeded);
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

                    {image && (
                        <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 animate-in fade-in duration-300">
                            <div className="aspect-square relative rounded-xl overflow-hidden bg-gray-50 mb-6 flex items-center justify-center">
                                <img
                                    src={`data:image/png;base64,${image}`}
                                    alt="Generated Icon"
                                    className="w-full h-full object-contain"
                                />
                            </div>

                            {aiMessage && (
                                <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3 items-start text-left">
                                    <div className="bg-blue-100 p-2 rounded-full shrink-0">
                                        <Sparkles size={16} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-blue-900">AI Designer</p>
                                        <p className="text-sm text-blue-700 mt-1 leading-relaxed">{aiMessage}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => downloadIcon(image, prompt)}
                                    className="flex items-center justify-center gap-2 bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-all"
                                >
                                    <Download size={18} />
                                    Download
                                </button>
                                <button
                                    onClick={() => {
                                        setImage(null);
                                        setPrompt('');
                                        setAiMessage('');
                                    }}
                                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-all"
                                >
                                    Create New
                                </button>
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div className="flex justify-center">
                            <IconDisplay image={null} loading={true} />
                        </div>
                    )}
                </div>

                {/* Gallery Toggle */}
                <div className="mt-16 flex justify-center gap-4">
                    <button
                        onClick={() => { setShowGallery(false); }}
                        className={`px-6 py-3 rounded-xl font-medium transition-all ${!showGallery ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        Generate
                    </button>
                    <button
                        onClick={() => { setShowGallery(true); fetchIcons(); }}
                        className={`px-6 py-3 rounded-xl font-medium transition-all ${showGallery ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        My Icons ({icons.length})
                    </button>
                </div>

                {/* Gallery View */}
                {showGallery && (
                    <div className="mt-12">
                        <h2 className="text-2xl font-bold mb-6">Your Icon Gallery</h2>
                        {icons.length === 0 ? (
                            <div className="text-center text-gray-500 py-12">
                                No icons yet. Generate your first icon to get started!
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {icons.map((icon: any) => (
                                    <div key={icon.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 group relative">
                                        <div className="aspect-square mb-3 bg-white rounded-lg flex items-center justify-center overflow-hidden relative">
                                            <img
                                                src={`data:image/png;base64,${icon.image_data}`}
                                                alt={icon.prompt}
                                                className="w-full h-full object-contain"
                                            />
                                            <button
                                                onClick={() => toggleFavorite(icon.id)}
                                                className="absolute top-2 right-2 p-2 rounded-full bg-white/80 hover:bg-white shadow-sm transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Star
                                                    size={16}
                                                    className={icon.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}
                                                />
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mb-3">{icon.prompt}</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => downloadIcon(icon.image_data, icon.prompt)}
                                                className="flex-1 bg-black text-white py-2 rounded-lg text-xs font-medium hover:bg-gray-800 transition-all"
                                            >
                                                Download
                                            </button>
                                            <button
                                                onClick={() => deleteIconHandler(icon.id)}
                                                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-all"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-all">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <Zap size={24} />
                        </div>
                        <h3 className="font-bold mb-2 text-lg">Lightning Fast</h3>
                        <p className="text-sm text-gray-500">Generate professional icons in seconds. No waiting for designers.</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-all">
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <Shield size={24} />
                        </div>
                        <h3 className="font-bold mb-2 text-lg">Commercial Rights</h3>
                        <p className="text-sm text-gray-500">You own every icon you generate. Use them in any project, royalty-free.</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-all">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <Download size={24} />
                        </div>
                        <h3 className="font-bold mb-2 text-lg">Production Ready</h3>
                        <p className="text-sm text-gray-500">High-resolution PNGs with transparent backgrounds, ready to ship.</p>
                    </div>
                </div>

                {/* How it Works */}
                <div className="mt-32 text-center">
                    <h2 className="text-3xl font-bold mb-12">How it Works</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -z-10 transform -translate-y-1/2"></div>

                        <div className="bg-white p-6">
                            <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
                            <h3 className="font-bold mb-2">Describe</h3>
                            <p className="text-sm text-gray-500">Simply type what you need, e.g., "blue rocket"</p>
                        </div>
                        <div className="bg-white p-6">
                            <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
                            <h3 className="font-bold mb-2">Generate</h3>
                            <p className="text-sm text-gray-500">Our AI creates unique, professional options instantly</p>
                        </div>
                        <div className="bg-white p-6">
                            <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
                            <h3 className="font-bold mb-2">Download</h3>
                            <p className="text-sm text-gray-500">Save your favorites and use them immediately</p>
                        </div>
                    </div>
                </div>

                {/* Testimonials */}
                <div className="mt-32 mb-20">
                    <h2 className="text-3xl font-bold mb-12 text-center">Loved by Creators</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100">
                            <div className="flex gap-1 text-yellow-400 mb-4">
                                <Star fill="currentColor" size={16} />
                                <Star fill="currentColor" size={16} />
                                <Star fill="currentColor" size={16} />
                                <Star fill="currentColor" size={16} />
                                <Star fill="currentColor" size={16} />
                            </div>
                            <p className="text-gray-600 mb-6">"IconForge saved me hundreds of dollars on my latest app. The icons look exactly like I hired a professional designer."</p>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-500">JD</div>
                                <div>
                                    <div className="font-bold text-sm">John Doe</div>
                                    <div className="text-xs text-gray-500">Indie Developer</div>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100">
                            <div className="flex gap-1 text-yellow-400 mb-4">
                                <Star fill="currentColor" size={16} />
                                <Star fill="currentColor" size={16} />
                                <Star fill="currentColor" size={16} />
                                <Star fill="currentColor" size={16} />
                                <Star fill="currentColor" size={16} />
                            </div>
                            <p className="text-gray-600 mb-6">"Finally an icon generator that actually understands simple prompts. The clean style is perfect for modern UI."</p>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-500">AS</div>
                                <div>
                                    <div className="font-bold text-sm">Sarah Smith</div>
                                    <div className="text-xs text-gray-500">Product Designer</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-gray-100 py-12 bg-gray-50">
                <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
                            <Sparkles size={16} />
                        </div>
                        IconForge
                    </div>
                    <div className="text-sm text-gray-500">
                        © 2024 IconForge. All rights reserved.
                    </div>
                    <div className="flex gap-6 text-sm text-gray-500">
                        <a href="#" className="hover:text-black transition-colors">Terms</a>
                        <a href="#" className="hover:text-black transition-colors">Privacy</a>
                        <a href="#" className="hover:text-black transition-colors">Contact</a>
                    </div>
                </div>
            </footer>

            <PricingModal
                isOpen={showPricing}
                onClose={() => setShowPricing(false)}
                onSelectPackage={handleSelectPackage}
                userEmail={email}
            />
        </main>
    );
}
