import { useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../api/client";
import { Loader2, Radar } from 'lucide-react';

interface Props {
    onScanComplete: (brandId: string, scanId: string) => void;
}

export function ScanForm({ onScanComplete }: Props) {
    const [brand, setBrand] = useState('');
    const [category, setCategory] = useState('');
    const { loading, error, run } = useAsync<{ scanId: string; brandId: string; }>();

    const handleSubmit = async () => {
        if (!brand.trim() || !category.trim()) return;
        const result = await run(api.createScan(brand.trim(), category.trim()));
        if (result) onScanComplete(result.brandId, result.scanId);
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-lg">
            <h2 className="text-lg font-medium text-gray-800 mb-4">Run a new scan</h2>

            <div className="flex flex-col gap-3">
                <div>
                    <label className="text-sm text-gray-500 mb-1 block">Brand name</label>
                    <input
                        type="text"
                        value={brand}
                        onChange={e => setBrand(e.target.value)}
                        placeholder="e.g. Bosch"
                        disabled={loading}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-50 disabled:text-gray-400"
                    />
                </div>

                <div>
                    <label className="text-sm text-gray-500 mb-1 block">Category</label>
                    <input
                        type="text"
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        placeholder="e.g. home appliances"
                        disabled={loading}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-50 disabled:text-gray-400"
                    />
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading || !brand.trim() || !category.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                     text-white text-sm font-medium rounded-lg py-2.5
                     transition-colors duration-150"
                >
                    {loading ? <div className="flex flex-row justify-center gap-2 items-center"><Loader2
                        className="h-5 w-5 animate-spin"
                    /><span>Scanning (~20s)</span></div> : <span className="flex items-center justify-center gap-2"><Radar className="w-4 h-4" /> Run scan</span>}
                </button>

                {error && (
                    <p className="text-sm text-red-500 mt-1">{error}</p>
                )}
            </div>
        </div>
    );
}