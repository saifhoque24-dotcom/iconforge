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
    const [icons, setIcons] = useState<any[]>([]);
    const [showGallery, setShowGallery] = useState(false);
    const [selectedStyle, setSelectedStyle] = useState('modern');
    const [selectedColor, setSelectedColor] = useState('vibrant');
    const [selectedSize, setSelectedSize] = useState('1024');
    const [batchMode, setBatchMode] = useState(false);
    const [batchImages, setBatchImages] = useState<string[]>([]);

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
        const creditsNeeded = batchMode ? 4 : 1;
        if (credits < creditsNeeded) {
            setShowPricing(true);
            return;
        }

        setLoading(true);
        setError('');
        setImage(null);
        setBatchImages([]);

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

            // Generate icon(s)
            if (batchMode) {
                // Generate 4 variations
                const promises = Array(4).fill(null).map(() =>
                    fetch('/api/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt, email, style: selectedStyle, color: selectedColor, size: selectedSize }),
                    }).then(res => res.json())
                );

                const results = await Promise.all(promises);
                const images = results.map(data => data.image).filter(Boolean);
                setBatchImages(images);
            } else {
                // Single generation
                const res = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, email, style: selectedStyle, color: selectedColor, size: selectedSize }),
                });

                const data = await res.json();

                if (!res.ok) {
                    const errorMessage = data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to generate icon');
                    throw new Error(errorMessage);
                }

                setImage(data.image);
            }
            fetchIcons(); // Refresh gallery
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
                    {/* Style Selector */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-3 text-gray-700">Choose Style</label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {[
                                { id: 'modern', label: 'Modern', emoji: '✨' },
                                { id: 'flat', label: 'Flat', emoji: '🎨' },
                                { id: '3d', label: '3D', emoji: '🎭' },
                                { id: 'gradient', label: 'Gradient', emoji: '🌈' },
                                { id: 'minimal', label: 'Minimal', emoji: '⚪' },
                            ].map((style) => (
                                <button
                                    key={style.id}
                                    type="button"
                                    onClick={() => setSelectedStyle(style.id)}
                                    className={`p-3 rounded-xl border-2 transition-all text-sm font-medium ${selectedStyle === style.id
                                        ? 'border-black bg-black text-white'
                                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    <span className="block text-lg mb-1">{style.emoji}</span>
                                    {style.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Color Palette Selector */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-3 text-gray-700">Color Palette</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[
                                { id: 'vibrant', label: 'Vibrant', colors: ['#FF6B6B', '#4ECDC4', '#45B7D1'] },
                                { id: 'pastel', label: 'Pastel', colors: ['#FFB3BA', '#BAFFC9', '#BAE1FF'] },
                                { id: 'dark', label: 'Dark', colors: ['#2C3E50', '#34495E', '#7F8C8D'] },
                                { id: 'monochrome', label: 'Mono', colors: ['#000000', '#666666', '#CCCCCC'] },
                            ].map((palette) => (
                                <button
                                    key={palette.id}
                                    type="button"
                                    onClick={() => setSelectedColor(palette.id)}
                                    className={`p-3 rounded-xl border-2 transition-all ${selectedColor === palette.id
                                        ? 'border-black bg-gray-50'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex gap-1 mb-2 justify-center">
                                        {palette.colors.map((color, i) => (
                                            <div key={i} className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                                        ))}
                                    </div>
                                    <span className="text-xs font-medium">{palette.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Size Selector */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-3 text-gray-700">Icon Size</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: '512', label: '512×512', desc: 'Small' },
                                { id: '1024', label: '1024×1024', desc: 'Standard' },
                                { id: '2048', label: '2048×2048', desc: 'Large' },
                            ].map((size) => (
                                <button
                                    key={size.id}
                                    type="button"
                                    onClick={() => setSelectedSize(size.id)}
                                    className={`p-3 rounded-xl border-2 transition-all text-sm font-medium ${selectedSize === size.id
                                        ? 'border-black bg-black text-white'
                                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="font-bold">{size.label}</div>
                                    <div className="text-xs opacity-70">{size.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Batch Mode Toggle */}
                    <div className="mb-6 flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div>
                            <div className="font-medium">Batch Mode</div>
                            <div className="text-xs text-gray-500">Generate 4 variations (uses 4 credits)</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setBatchMode(!batchMode)}
                            className={`relative w-14 h-7 rounded-full transition-colors ${batchMode ? 'bg-black' : 'bg-gray-300'
                                }`}
                        >
                            <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${batchMode ? 'transform translate-x-7' : ''
                                }`} />
                        </button>
                    </div>

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

                    {image && (
                        <div className="flex justify-center mt-4">
                            <button
                                onClick={() => downloadIcon(image, prompt)}
                                className="bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition-all"
                            >
                                Download Icon
                            </button>
                        </div>
                    )}

                    {/* Batch Results Grid */}
                    {batchImages.length > 0 && (
                        <div className="mt-8">
                            <h3 className="text-lg font-bold mb-4 text-center">4 Variations Generated</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {batchImages.map((img, index) => (
                                    <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                        <img
                                            src={`data:image/png;base64,${img}`}
                                            alt={`Variation ${index + 1}`}
                                            className="w-full aspect-square object-contain mb-3"
                                        />
                                        <button
                                            onClick={() => downloadIcon(img, `${prompt}_v${index + 1}`)}
                                            className="w-full bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-all text-sm font-medium"
                                        >
                                            Download #{index + 1}
                                        </button>
                                    </div>
                                ))}
                            </div>
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
                                    <div key={icon.id} className="group relative bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-gray-300 transition-all">
                                        <img
                                            src={`data:image/png;base64,${icon.image_data}`}
                                            alt={icon.prompt}
                                            className="w-full aspect-square object-contain mb-2"
                                        />
                                        <p className="text-xs text-gray-500 truncate mb-2">{icon.prompt}</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => downloadIcon(icon.image_data, icon.prompt)}
                                                className="flex-1 bg-black text-white text-xs px-3 py-2 rounded-lg hover:bg-gray-800 transition-all"
                                            >
                                                Download
                                            </button>
                                            <button
                                                onClick={() => deleteIconHandler(icon.id)}
                                                className="bg-red-100 text-red-600 text-xs px-3 py-2 rounded-lg hover:bg-red-200 transition-all"
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
