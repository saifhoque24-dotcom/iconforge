"use client";

import { X, Check } from 'lucide-react';

interface PricingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectPackage: (packageType: string) => void;
    userEmail: string;
}

const PACKAGES = [
    {
        id: 'starter',
        name: 'Starter',
        credits: 10,
        price: 5,
        popular: false,
    },
    {
        id: 'popular',
        name: 'Popular',
        credits: 50,
        price: 20,
        popular: true,
    },
    {
        id: 'pro',
        name: 'Pro',
        credits: 100,
        price: 35,
        popular: false,
    },
];

export default function PricingModal({ isOpen, onClose, onSelectPackage, userEmail }: PricingModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-4xl w-full p-8 relative shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold mb-2">Choose Your Credits</h2>
                    <p className="text-gray-500">Select a package to continue generating icons</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {PACKAGES.map((pkg) => (
                        <div
                            key={pkg.id}
                            className={`relative border-2 rounded-2xl p-6 hover:shadow-lg transition-all cursor-pointer ${pkg.popular ? 'border-black bg-gray-50' : 'border-gray-200'
                                }`}
                            onClick={() => onSelectPackage(pkg.id)}
                        >
                            {pkg.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-1 rounded-full text-sm font-medium">
                                    Most Popular
                                </div>
                            )}

                            <div className="text-center mb-4">
                                <h3 className="text-xl font-bold mb-1">{pkg.name}</h3>
                                <div className="text-4xl font-extrabold mb-2">${pkg.price}</div>
                                <div className="text-gray-500 text-sm">{pkg.credits} credits</div>
                                <div className="text-gray-400 text-xs mt-1">
                                    ${(pkg.price / pkg.credits).toFixed(2)} per icon
                                </div>
                            </div>

                            <button className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
                                <Check size={18} />
                                Select
                            </button>
                        </div>
                    ))}
                </div>

                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>✓ Commercial license included</p>
                    <p>✓ High-resolution downloads</p>
                    <p>✓ No watermarks</p>
                </div>
            </div>
        </div>
    );
}
