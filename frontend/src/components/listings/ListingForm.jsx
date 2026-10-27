import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { Gift, Lightbulb, Plus, X } from "lucide-react";
import ImagePicker from "./ImagePicker";
import ListingCard from "./ListingCard";
import Button from "../ui/Button";
import { Input, Select, Textarea } from "../ui/Field";
import Switch from "../ui/Switch";
import { CATEGORIES, CONDITIONS, LISTING_TYPES, RENT_PERIODS } from "../../constants/listing";
import { getErrorMessage, getFieldErrors } from "../../utils/errors";

const PRICED_TYPES = ["sell", "rent", "kit"];

const toForm = (listing) => ({
  type: listing?.type ?? "sell",
  title: listing?.title ?? "",
  description: listing?.description ?? "",
  category: listing?.category ?? "",
  condition: listing?.condition ?? "",
  price: listing?.price != null && listing.type !== "free" ? String(listing.price) : "",
  rentPeriod: listing?.rentPeriod ?? "day",
  swapFor: listing?.swapFor ?? "",
  negotiable: listing?.negotiable ?? true,
  kitItems: listing?.kitItems ?? [],
});

// Same rules as backend/validators/listing.validators.js, so most mistakes are caught instantly.
const validate = (form, photoCount) => {
  const errors = {};
  if (form.title.trim().length < 3) errors.title = "Title must be at least 3 characters";
  if (!form.category) errors.category = "Pick a category";
  if (form.type !== "wanted" && !form.condition) errors.condition = "Pick a condition";
  if (PRICED_TYPES.includes(form.type) && !(Number(form.price) >= 1)) {
    errors.price = form.type === "rent" ? "Enter the rent amount" : "Enter a price";
  }
  if (form.type === "swap" && form.swapFor.trim().length < 2) errors.swapFor = "What do you want in exchange?";
  if (form.type === "kit" && form.kitItems.length < 2) errors.kitItems = "List at least 2 items in the kit";
  if (form.type !== "wanted" && photoCount === 0) errors.images = "Add at least one photo";
  return errors;
};

function Section({ step, title, description, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white dark:bg-brand-500">
          {step}
        </span>
        <div>
          <h2 className="font-bold">{title}</h2>
          {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const choiceClasses = (selected, error) =>
  `rounded-2xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-brand-500 ${
    selected
      ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-500/10"
      : error
        ? "border-rose-300 hover:border-rose-400 dark:border-rose-500/50"
        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
  }`;

function PriceInput({ label, value, onChange, error, hint, optional = false }) {
  return (
    <Input
      label={optional ? `${label} (optional)` : label}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 7))}
      inputMode="numeric"
      placeholder="0"
      error={error}
      hint={hint}
      icon={RupeeIcon}
    />
  );
}

// The Input component expects an icon component; a ₹ sign fits better than any icon.
function RupeeIcon({ className }) {
  return (
    <span className={`${className} grid place-items-center text-base leading-none font-semibold`} aria-hidden>
      ₹
    </span>
  );
}

function KitItemsEditor({ items, onChange, error }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const item = draft.trim();
    if (!item) return;
    if (items.length >= 20) return toast.info("Up to 20 items");
    if (!items.some((existing) => existing.toLowerCase() === item.toLowerCase())) onChange([...items, item.slice(0, 60)]);
    setDraft("");
  };

  return (
    <div data-error={Boolean(error) || undefined}>
      <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">What's in the kit?</p>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="e.g. DBMS by Korth"
          maxLength={60}
          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 text-base shadow-sm outline-hidden focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 pointer-fine:text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <Button variant="secondary" onClick={add} aria-label="Add item">
          <Plus className="size-4" /> Add
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-1 pl-3 text-sm font-medium dark:bg-slate-800">
              {item}
              <button
                type="button"
                onClick={() => onChange(items.filter((i) => i !== item))}
                aria-label={`Remove ${item}`}
                className="grid size-6 place-items-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

const TIPS = [
  "Use daylight and a plain background for photos.",
  "Show any scratches or damage honestly: it builds trust.",
  "Mention the edition, model or size in the title.",
  "Price slightly above your minimum if you're open to offers.",
];

// Shared by "Sell" and "Edit listing". onSubmit(formData, onProgress) does the upload.
export default function ListingForm({ initial, submitLabel, onSubmit }) {
  const me = useSelector((state) => state.auth.user);
  const [form, setForm] = useState(() => toForm(initial));
  const [photos, setPhotos] = useState(() =>
    (initial?.images ?? []).map((image) => ({ id: image.publicId, kind: "existing", url: image.url, publicId: image.publicId })),
  );
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(null);
  const submitting = progress !== null;

  // Free the in-memory previews when leaving the page.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(
    () => () => photosRef.current.forEach((photo) => photo.kind === "new" && URL.revokeObjectURL(photo.url)),
    [],
  );

  const set = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updatePhotos = (updater) => {
    setPhotos(updater);
    setErrors((current) => ({ ...current, images: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const clientErrors = validate(form, photos.length);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      toast.error(Object.values(clientErrors)[0]);
      // Scroll to the first field with a problem.
      requestAnimationFrame(() =>
        document.querySelector('[aria-invalid="true"], [data-error="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
      return;
    }

    let newIndex = 0;
    const payload = {
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      condition: form.condition || null,
      price: form.price === "" ? null : Number(form.price),
      rentPeriod: form.type === "rent" ? form.rentPeriod : null,
      swapFor: form.swapFor.trim(),
      negotiable: form.negotiable,
      kitItems: form.kitItems,
      // Editing: which current photos to keep, and the final order of old + new photos.
      keepImages: photos.filter((p) => p.kind === "existing").map((p) => p.publicId),
      imageOrder: photos.map((p) => (p.kind === "existing" ? `k:${p.publicId}` : `n:${newIndex++}`)),
    };

    // Files can't go in JSON, so this is a multipart form: the fields as one JSON string + the photos.
    const formData = new FormData();
    formData.append("data", JSON.stringify(payload));
    photos.filter((p) => p.kind === "new").forEach((p) => formData.append("images", p.file, p.file.name));

    setProgress(0);
    try {
      await onSubmit(formData, setProgress);
    } catch (error) {
      setErrors(getFieldErrors(error));
      toast.error(getErrorMessage(error));
      setProgress(null);
    }
  };

  const preview = {
    _id: "preview",
    type: form.type,
    title: form.title.trim() || "Your listing title",
    price: form.type === "free" ? 0 : Number(form.price) || (PRICED_TYPES.includes(form.type) ? 0 : undefined),
    rentPeriod: form.rentPeriod,
    images: photos[0] ? [{ url: photos[0].url }] : [],
    imageCount: photos.length,
    hostel: me.hostel,
    distance: 0,
    createdAt: new Date().toISOString(),
    status: "active",
    seller: { _id: me._id },
  };

  const showsCondition = form.type !== "wanted";

  return (
    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <Section step={1} title="What are you listing?">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Listing type">
            {LISTING_TYPES.map(({ value, label, icon: Icon, gradient, example }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.type === value}
                onClick={() => set("type", value)}
                className={choiceClasses(form.type === value)}
              >
                <span className={`grid size-9 place-items-center rounded-xl bg-linear-to-br text-white ${gradient}`}>
                  <Icon className="size-[18px]" />
                </span>
                <span className="mt-2 block text-sm font-bold">{label}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">{example}</span>
              </button>
            ))}
          </div>
          {/* e.g. "You can't change the type after people have messaged you" (from the server) */}
          {errors.type && (
            <p data-error className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
              {errors.type}
            </p>
          )}
        </Section>

        <Section
          step={2}
          title="Photos"
          description={form.type === "wanted" ? "Optional: a photo of what you're looking for helps." : "Clear photos get far more replies."}
        >
          <ImagePicker photos={photos} onChange={updatePhotos} error={errors.images} optional={form.type === "wanted"} />
        </Section>

        <Section step={3} title="Details">
          <div className="space-y-5">
            <Input
              label="Title"
              labelAside={<span className="text-xs text-slate-400 tabular-nums">{form.title.length}/80</span>}
              value={form.title}
              onChange={(event) => set("title", event.target.value.slice(0, 80))}
              placeholder={form.type === "wanted" ? "e.g. Looking for a Casio fx-991 calculator" : "e.g. Casio fx-991EX calculator, barely used"}
              error={errors.title}
            />

            <div data-error={Boolean(errors.category) || undefined}>
              <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Category</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set("category", value)}
                    aria-pressed={form.category === value}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      form.category === value
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                        : errors.category
                          ? "border-rose-300 dark:border-rose-500/50"
                          : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="size-4" /> {label}
                  </button>
                ))}
              </div>
              {errors.category && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{errors.category}</p>}
            </div>

            {showsCondition && (
              <div data-error={Boolean(errors.condition) || undefined}>
                <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Condition</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Condition">
                  {CONDITIONS.map(({ value, label, hint }) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={form.condition === value}
                      onClick={() => set("condition", value)}
                      className={choiceClasses(form.condition === value, errors.condition)}
                    >
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
                    </button>
                  ))}
                </div>
                {errors.condition && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{errors.condition}</p>}
              </div>
            )}

            <Textarea
              label="Description (optional)"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Edition, how long you've used it, why you're selling, anything a buyer should know…"
              error={errors.description}
            />
          </div>
        </Section>

        <Section step={4} title={form.type === "swap" ? "Swap" : form.type === "wanted" ? "Budget" : "Price"}>
          {form.type === "free" ? (
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
              <Gift className="mt-0.5 size-5 shrink-0" />
              <p className="text-sm">
                Nice! Free listings get a big <strong>FREE</strong> badge. Someone nearby will pick it up, and it's one less thing to carry home.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {form.type === "swap" && (
                <Input
                  label="What do you want in exchange?"
                  value={form.swapFor}
                  onChange={(event) => set("swapFor", event.target.value.slice(0, 120))}
                  placeholder="e.g. DBMS book by Korth, or any scientific calculator"
                  error={errors.swapFor}
                />
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <PriceInput
                  label={
                    form.type === "rent" ? "Rent" : form.type === "swap" ? "Or sell it for" : form.type === "wanted" ? "Your budget" : form.type === "kit" ? "Price for the whole kit" : "Price"
                  }
                  optional={form.type === "swap" || form.type === "wanted"}
                  value={form.price}
                  onChange={(value) => set("price", value)}
                  error={errors.price}
                  hint={form.type === "wanted" ? "The most you'd pay. Leave empty to take offers." : undefined}
                />
                {form.type === "rent" && (
                  <Select label="Per" value={form.rentPeriod} onChange={(event) => set("rentPeriod", event.target.value)}>
                    {RENT_PERIODS.map((period) => (
                      <option key={period.value} value={period.value}>
                        {period.label}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              {form.type === "kit" && <KitItemsEditor items={form.kitItems} onChange={(items) => set("kitItems", items)} error={errors.kitItems} />}

              {form.type !== "wanted" && (
                <Switch
                  checked={form.negotiable}
                  onChange={(value) => set("negotiable", value)}
                  label="Open to offers"
                  description="Buyers can suggest a different price."
                />
              )}
            </div>
          )}
        </Section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          {submitting && (
            <div className="flex items-center gap-3 sm:mr-auto" aria-live="polite">
              <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full rounded-full bg-linear-to-r from-brand-500 to-fuchsia-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-sm text-slate-500 tabular-nums">{progress < 100 ? `Uploading ${progress}%` : "Almost done…"}</span>
            </div>
          )}
          <Button type="submit" variant="gradient" size="lg" loading={submitting} className="sm:min-w-48">
            {submitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-4">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Live preview</p>
          <ListingCard listing={preview} preview />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Lightbulb className="size-4 text-amber-500" /> Tips for a quick sale
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              {TIPS.map((tip) => (
                <li key={tip}>• {tip}</li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </form>
  );
}
