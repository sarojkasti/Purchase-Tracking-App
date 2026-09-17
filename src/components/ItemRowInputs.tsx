"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Product = {
  chineseSku: string;
  newmewSku: string | null;
  specificName: string | null;
  itemType: string | null;
  brand: string | null;
  gender: string | null;
  size: string | null;
  front: string | null;
  temple: string | null;
  lens: string | null;
  mrp: number | null;
  imageUrl: string | null;
};

export type Color = {
  id: string;
  name: string;
  code: string;
};

export function deriveCategory(front: string, temple: string, lens: string) {
  return [front, temple, lens].filter(Boolean).join("+");
}

export function deriveSize(lens: string, bridge: string, temple: string) {
  if (!lens && !bridge && !temple) return "";
  return `${lens.padStart(2, "0")}-${bridge.padStart(2, "0")}-${temple.padStart(3, "0")}`;
}

export function SkuAutocomplete({
  value,
  onChange,
  onSelect,
  onBlur,
  required,
  rowIndex,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (product: Product) => void;
  onBlur?: () => void;
  required?: boolean;
  rowIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/products?q=${encodeURIComponent(q)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setResults(data);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  function updatePosition() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 220) });
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="input"
        value={value}
        required={required}
        data-row-first-field={rowIndex}
        onChange={(e) => {
          onChange(e.target.value);
          updatePosition();
          setOpen(true);
        }}
        onFocus={() => {
          updatePosition();
          setOpen(true);
        }}
        onBlur={() => {
          // Delay closing so a click on a suggestion (which also blurs the
          // input) still registers before the overlay unmounts.
          setTimeout(() => setOpen(false), 150);
          onBlur?.();
        }}
      />
      {open &&
        results.length > 0 &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="fixed z-50 max-h-56 overflow-y-auto bg-white border rounded shadow-lg py-1"
              style={{ top: coords.top, left: coords.left, width: coords.width }}
            >
              {results.map((p) => (
                <button
                  key={p.chineseSku}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="w-6 h-6 object-cover rounded border shrink-0" />
                  ) : (
                    <span className="w-6 h-6 shrink-0" />
                  )}
                  <span className="font-mono">{p.chineseSku}</span>
                  {p.specificName && <span className="text-gray-400 truncate">{p.specificName}</span>}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

export function ItemImageInput({
  imageUrl,
  onUpload,
  onClear,
}: {
  imageUrl: string;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-1">
      {imageUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Item" className="w-10 h-10 object-cover rounded border" />
          <button
            type="button"
            onClick={onClear}
            className="absolute -top-1.5 -right-1.5 bg-white border rounded-full w-4 h-4 text-[10px] leading-none text-red-600 hover:bg-red-50"
            title="Remove image"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-10 h-10 flex items-center justify-center border border-dashed rounded text-gray-400 text-xs hover:bg-gray-50 disabled:opacity-50"
          title="Upload image"
        >
          {uploading ? "…" : "+"}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </div>
  );
}

export function ColorMultiSelect({
  colors,
  selected,
  onChange,
  onClose,
}: {
  colors: Color[];
  selected: string[];
  onChange: (selected: string[]) => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  }

  function handleOpen() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 192) });
    }
    setOpen((o) => !o);
  }

  function handleClose() {
    setOpen(false);
    onClose?.();
  }

  return (
    <div className="relative">
      <button ref={buttonRef} type="button" onClick={handleOpen} className="input text-left bg-white truncate">
        {selected.length > 0 ? selected.join(", ") : <span className="text-gray-400">Select colors</span>}
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={handleClose} />
            <div
              className="fixed z-50 max-h-56 overflow-y-auto bg-white border rounded shadow-lg py-1"
              style={{ top: coords.top, left: coords.left, width: coords.width }}
            >
              {colors.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">
                  No colors defined. Add some under Masters → Colors.
                </div>
              )}
              {colors.map((c) => (
                <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selected.includes(c.name)} onChange={() => toggle(c.name)} />
                  <span className="text-gray-400 font-mono text-xs">{c.code}</span>
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
