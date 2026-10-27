import { useEffect, useState } from "react";
import { LayoutGrid, Search, X } from "lucide-react";
import { Select } from "../ui/Field";
import Button from "../ui/Button";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  CATEGORIES,
  CATEGORY_MAP,
  CONDITIONS,
  CONDITION_MAP,
  DISTANCE_OPTIONS,
  LISTING_TYPES,
  SORT_OPTIONS,
} from "../../constants/listing";
import { formatRupees } from "../../utils/format";

export const PANEL_FILTER_KEYS = ["category", "condition", "minPrice", "maxPrice", "within"];

export function SearchInput({ value, onChange }) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search books, cycles, calculators…"
        aria-label="Search listings"
        className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-10 text-base shadow-sm outline-hidden transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 pointer-fine:text-sm dark:border-slate-700 dark:bg-slate-900 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function SortSelect({ value, onChange, hasQuery, className = "" }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Sort listings"
      className={`h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium shadow-sm outline-hidden focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 pointer-fine:text-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      {SORT_OPTIONS.filter((option) => option.value !== "relevance" || hasQuery).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function TypeChips({ value, onChange }) {
  const chip = (active) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
      active
        ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
    }`;

  return (
    // Scrolls sideways on phones instead of wrapping.
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <button type="button" onClick={() => onChange(undefined)} className={chip(!value)} aria-pressed={!value}>
        <LayoutGrid className="size-4" /> All
      </button>
      {LISTING_TYPES.map(({ value: type, label, icon: Icon }) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type === value ? undefined : type)}
          className={chip(type === value)}
          aria-pressed={type === value}
        >
          <Icon className="size-4" /> {label}
        </button>
      ))}
    </div>
  );
}

// Typing a price only applies once you pause, so "500" doesn't fire three searches.
function PriceInput({ label, value, onCommit }) {
  const [draft, setDraft] = useState(value ?? "");
  const debounced = useDebouncedValue(draft, 500);

  useEffect(() => setDraft(value ?? ""), [value]);
  // Runs only when the typed value settles. Depending on `value` too would re-apply an old
  // draft right after "Reset filters" clears the URL.
  useEffect(() => {
    if (debounced !== (value ?? "")) onCommit(debounced);
  }, [debounced]);

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-slate-400 pointer-fine:text-sm">₹</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={draft}
          onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
          placeholder="Any"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-8 text-base shadow-sm outline-hidden focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 pointer-fine:text-sm dark:border-slate-700 dark:bg-slate-900"
        />
      </div>
    </label>
  );
}

export function FilterPanel({ filters, sort, onChange, onReset }) {
  return (
    <div className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Select label="Category" value={filters.category ?? ""} onChange={(e) => onChange({ category: e.target.value })} className="col-span-2 sm:col-span-1">
          <option value="">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </Select>
        <Select label="Condition" value={filters.condition ?? ""} onChange={(e) => onChange({ condition: e.target.value })} className="col-span-2 sm:col-span-1">
          <option value="">Any condition</option>
          {CONDITIONS.map((condition) => (
            <option key={condition.value} value={condition.value}>
              {condition.label}
            </option>
          ))}
        </Select>
        <Select label="Distance" value={filters.within ?? ""} onChange={(e) => onChange({ within: e.target.value })} className="col-span-2 sm:col-span-1">
          {DISTANCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <PriceInput label="Min price" value={filters.minPrice} onCommit={(minPrice) => onChange({ minPrice })} />
        <PriceInput label="Max price" value={filters.maxPrice} onCommit={(maxPrice) => onChange({ maxPrice })} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="sm:hidden">
          <SortSelect value={sort} onChange={(value) => onChange({ sort: value })} hasQuery={Boolean(filters.q)} />
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto">
          Reset filters
        </Button>
      </div>
    </div>
  );
}

const chipLabel = {
  category: (v) => CATEGORY_MAP[v]?.label,
  condition: (v) => CONDITION_MAP[v]?.label,
  minPrice: (v) => `From ${formatRupees(Number(v))}`,
  maxPrice: (v) => `Up to ${formatRupees(Number(v))}`,
  within: (v) => DISTANCE_OPTIONS.find((option) => option.value === v)?.label ?? `Within ${v} m`,
};

export function ActiveFilterChips({ filters, onRemove }) {
  const active = PANEL_FILTER_KEYS.filter((key) => filters[key]);
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {active.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onRemove(key)}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
        >
          {chipLabel[key](filters[key])} <X className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
