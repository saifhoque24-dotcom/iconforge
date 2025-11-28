"use client";

import { Coins } from 'lucide-react';

interface CreditBalanceProps {
    credits: number;
    onBuyMore: () => void;
}

export default function CreditBalance({ credits, onBuyMore }: CreditBalanceProps) {
    return (
        <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2">
                <Coins size={20} className="text-gray-600" />
                <span className="font-bold text-lg">{credits}</span>
                <span className="text-gray-500 text-sm">credits</span>
            </div>
            <button
                onClick={onBuyMore}
                className="ml-2 px-4 py-1 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
                Buy More
            </button>
        </div>
    );
}
