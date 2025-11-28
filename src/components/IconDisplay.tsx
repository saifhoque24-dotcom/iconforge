"use client";

import { Download } from 'lucide-react';

interface IconDisplayProps {
    image: string | null;
    loading: boolean;
}

export default function IconDisplay({ image, loading }: IconDisplayProps) {
    if (loading) {
        return (
            <div className="w-64 h-64 bg-gray-100 rounded-2xl animate-pulse flex items-center justify-center border border-gray-200">
                <div className="text-gray-400 text-sm font-medium">Generating...</div>
            </div>
        );
    }

    if (!image) {
        return (
            <div className="w-64 h-64 bg-gray-50 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-200">
                <div className="text-gray-400 text-sm text-center px-4">
                    Enter a prompt to generate an icon
                </div>
            </div>
        );
    }

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${image}`;
        link.download = `icon-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative group">
                <div className="w-64 h-64 bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 p-4 flex items-center justify-center">
                    <img
                        src={`data:image/png;base64,${image}`}
                        alt="Generated Icon"
                        className="w-full h-full object-contain"
                    />
                </div>
                <button
                    onClick={handleDownload}
                    className="absolute bottom-4 right-4 bg-black text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-800"
                    title="Download PNG"
                >
                    <Download size={20} />
                </button>
            </div>
        </div>
    );
}
