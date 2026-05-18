import { useState } from 'react';
import { api, type BrandComparisonResult } from '../api/client';
import { Loader2, Plus, Trash2, GitCompareArrows } from 'lucide-react';

interface Props {
    onResult: (result: BrandComparisonResult[]) => void;
}

export function CompareForm({ onResult }: Props) {
    const [brands, setBrands] = useState<string[]>(['', '']);
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSubmit =
        !loading &&
        brands.every((b) => b.trim().length >= 2) &&
        category.trim().length >= 2;

    const setBrand = (i: number, val: string) => {
        setBrands((prev) => prev.map((b, idx) => (idx === i ? val : b)));
    };

    const addBrand = () => {
        if (brands.length < 4) setBrands((prev) => [...prev, '']);
    };

    const removeBrand = (i: number) => {
        if (brands.length <= 2) return;
        setBrands((prev) => prev.filter((_, idx) => idx !== i));
    };

    const handleSubmit = async () => {
        setError(null);
        setLoading(true);
        try {
            const result = await api.compareBrands(
                brands.map((b) => b.trim()),
                category.trim(),
            );
            onResult(result);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Comparison failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 w-full">
            <h2 className="text-lg font-medium text-gray-800 mb-4">
                Compare brands
            </h2>

            <div className="flex flex-col gap-4">
                <div>
                    <label className="text-sm text-gray-500 mb-1 block">Category</label>
                    <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="e.g. home appliances"
                        disabled={loading}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-50 disabled:text-gray-400"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm text-gray-500">Brands to compare (2–4)</label>
                    {brands.map((brand, i) => (
                        <div key={i} className="flex gap-2">
                            <input
                                type="text"
                                value={brand}
                                onChange={(e) => setBrand(i, e.target.value)}
                                placeholder={`Brand ${i + 1}`}
                                disabled={loading}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500
                               disabled:bg-gray-50 disabled:text-gray-400"
                            />
                            {brands.length > 2 && (
                                <button
                                    onClick={() => removeBrand(i)}
                                    disabled={loading}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors
                                   disabled:opacity-40"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                    {brands.length < 4 && (
                        <button
                            onClick={addBrand}
                            disabled={loading}
                            className="flex items-center gap-1.5 text-sm text-blue-600
                           hover:text-blue-700 disabled:opacity-40 w-fit"
                        >
                            <Plus className="w-4 h-4" /> Add brand
                        </button>
                    )}
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                     text-white text-sm font-medium rounded-lg py-2.5
                     transition-colors duration-150"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Comparing...
                        </span>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            <GitCompareArrows className="w-4 h-4" /> Compare
                        </span>
                    )}
                </button>

                {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
        </div>
    );
}
