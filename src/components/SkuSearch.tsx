"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ProductSuggestion = {
  chineseSku: string;
  newmewSku: string | null;
  specificName: string | null;
  brand: string | null;
  imageUrl: string | null;
};

export default function SkuSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/sku-search?q=${encodeURIComponent(query)}`);
      if (res.ok) setSuggestions(await res.json());
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function selectProduct(p: ProductSuggestion) {
    router.push(`/reports/sku-history?sku=${encodeURIComponent(p.chineseSku)}`);
  }

  return (
    <div className="bg-white border rounded p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2">SKU History Search</h3>
      <div ref={wrapRef} className="relative">
        <input
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          placeholder="Search by Chinese SKU, Newmew SKU, or product name…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-64 overflow-y-auto">
            {suggestions.map((p) => (
              <button
                key={p.chineseSku}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                onMouseDown={(e) => { e.preventDefault(); selectProduct(p); }}
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="w-8 h-8 object-cover rounded shrink-0" />
                ) : (
                  <div className="w-8 h-8 bg-gray-100 rounded shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.chineseSku}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {[p.newmewSku, p.specificName, p.brand].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
