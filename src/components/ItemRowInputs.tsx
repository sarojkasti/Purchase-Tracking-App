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

export type SelectOption = { value: string; label: string };

export const strOptions = (values: string[]): SelectOption[] =>
  values.map((v) => ({ value: v, label: v }));

export const MFG_TYPE_OPTIONS: SelectOption[] = [
  { value: "READY_GOODS", label: "Ready Goods" },
  { value: "PRODUCTION", label: "Production" },
];

export function SearchSelect({
  value,
  options,
  onChange,
  allowEmpty = true,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;
  const q = (query ?? "").trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  function updatePosition() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 160) });
  }

  function choose(opt: SelectOption) {
    onChange(opt.value);
    setQuery(null);
    setOpen(false);
  }

  function commitOnBlur() {
    if (query !== null) {
      if (query.trim() === "") {
        if (allowEmpty) onChange("");
      } else {
        const exact = options.find((o) => o.label.toLowerCase() === q);
        const pick = exact ?? filtered[Math.min(highlight, filtered.length - 1)];
        if (pick) onChange(pick.value);
      }
    }
    setQuery(null);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="input"
        placeholder="-"
        value={query ?? selectedLabel}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          updatePosition();
          setOpen(true);
        }}
        onFocus={(e) => {
          e.target.select();
          updatePosition();
          setOpen(true);
        }}
        onBlur={commitOnBlur}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            if (open && filtered[highlight]) {
              e.preventDefault();
              choose(filtered[highlight]);
            }
          } else if (e.key === "Escape") {
            setQuery(null);
            setOpen(false);
          }
        }}
      />
      {open &&
        filtered.length > 0 &&
        createPortal(
          <div
            className="fixed z-50 max-h-56 overflow-y-auto bg-white border rounded shadow-lg py-1"
            style={{ top: coords.top, left: coords.left, width: coords.width }}
          >
            {filtered.map((o, i) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${
                  i === highlight ? "bg-gray-100" : ""
                } ${o.value === value ? "font-medium" : ""}`}
              >
                {o.label}
              </button>
            ))}
          </div>,
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
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    if (!enlarged) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEnlarged(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlarged]);

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
          <img
            src={imageUrl}
            alt="Item"
            className="w-10 h-10 object-cover rounded border cursor-zoom-in"
            onClick={() => setEnlarged(true)}
          />
          {enlarged &&
            createPortal(
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6 cursor-zoom-out"
                onClick={() => setEnlarged(false)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Item"
                  className="max-h-full max-w-full rounded shadow-lg bg-white"
                />
              </div>,
              document.body
            )}
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
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const q = (query ?? "").trim().toLowerCase();
  const filtered = q
    ? colors.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    : colors;

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  }

  function updatePosition() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 200) });
  }

  function handleClose() {
    setQuery(null);
    setOpen(false);
    onClose?.();
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="input"
        placeholder="Select colors"
        value={query ?? selected.join(", ")}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          updatePosition();
          setOpen(true);
        }}
        onFocus={(e) => {
          e.target.select();
          updatePosition();
          setOpen(true);
        }}
        onBlur={handleClose}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            if (open && filtered[highlight]) {
              e.preventDefault();
              toggle(filtered[highlight].name);
              setQuery("");
              setHighlight(0);
            }
          } else if (e.key === "Escape") {
            handleClose();
          }
        }}
      />
      {open &&
        createPortal(
          <div
            className="fixed z-50 max-h-56 overflow-y-auto bg-white border rounded shadow-lg py-1"
            style={{ top: coords.top, left: coords.left, width: coords.width }}
          >
            {colors.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">
                No colors defined. Add some under Masters → Colors.
              </div>
            )}
            {colors.length > 0 && filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">No matching colors.</div>
            )}
            {filtered.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggle(c.name)}
                className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 ${
                  i === highlight ? "bg-gray-100" : ""
                }`}
              >
                <input type="checkbox" readOnly tabIndex={-1} checked={selected.includes(c.name)} />
                <span className="text-gray-400 font-mono text-xs">{c.code}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
