"use client";

/* eslint-disable @next/next/no-img-element -- local object-URL previews can't use next/image */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/overlays";
import { Chip, Surface } from "@/components/ui/primitives";
import { ApiError, api, errorMessage } from "@/lib/api";
import {
  AMENITIES,
  CLEANLINESS_LABEL,
  FOOD_LABEL,
  FURNISHING_LABEL,
  GENDER_LABEL,
  humanize,
  ROOM_TYPE_LABEL,
  SLEEP_LABEL,
} from "@/lib/format";
import type { Listing, Photo } from "@/lib/types";

import { ListingImage } from "./listing-image";

const COMMON_RULES = ["no-smoking", "no-pets", "pet-friendly", "quiet-after-10pm", "vegetarian-kitchen", "no-overnight-guests", "couples-welcome"];
const MAX_TOTAL = 10;
const MAX_PER_UPLOAD = 8;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

type TriState = "" | "true" | "false";

interface FormState {
  title: string;
  description: string;
  location: string;
  locality: string;
  address: string;
  rent: string;
  deposit: string;
  availableFrom: string;
  roomType: string;
  furnishingStatus: string;
  maxOccupants: string;
  genderPreference: string;
  amenities: string[];
  rules: string[];
  smokingAllowed: TriState;
  petsAllowed: TriState;
  foodPolicy: string;
  householdSleepSchedule: string;
  householdCleanliness: string;
}

const tri = (b: boolean | null | undefined): TriState => (b === true ? "true" : b === false ? "false" : "");

function initial(l?: Listing): FormState {
  return {
    title: l?.title ?? "",
    description: l?.description ?? "",
    location: l?.location ?? "",
    locality: l?.locality ?? "",
    address: l?.address ?? "",
    rent: l ? String(l.rent) : "",
    deposit: l?.deposit != null ? String(l.deposit) : "",
    availableFrom: l?.availableFrom.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    roomType: l?.roomType ?? "SINGLE",
    furnishingStatus: l?.furnishingStatus ?? "FURNISHED",
    maxOccupants: l ? String(l.maxOccupants) : "1",
    genderPreference: l?.genderPreference ?? "ANY",
    amenities: l?.amenities ?? [],
    rules: l?.rules ?? [],
    smokingAllowed: tri(l?.smokingAllowed),
    petsAllowed: tri(l?.petsAllowed),
    foodPolicy: l?.foodPolicy ?? "",
    householdSleepSchedule: l?.householdSleepSchedule ?? "",
    householdCleanliness: l?.householdCleanliness != null ? String(l.householdCleanliness) : "",
  };
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Surface className="p-6 sm:p-8">
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-6">{children}</div>
    </Surface>
  );
}

export function ListingForm({ listing }: { listing?: Listing }) {
  const router = useRouter();
  const editing = Boolean(listing);
  const [form, setForm] = useState<FormState>(() => initial(listing));
  const [existing, setExisting] = useState<Photo[]>(listing?.photos ?? []);
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [customAmenity, setCustomAmenity] = useState("");
  const [customRule, setCustomRule] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [deletePhoto, setDeletePhoto] = useState<Photo | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const orderChanged = useRef(false);

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: "amenities" | "rules", v: string) =>
    setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const room = Math.min(MAX_TOTAL - existing.length - files.length, MAX_PER_UPLOAD - files.length);
    const accepted: { file: File; url: string }[] = [];
    for (const file of incoming) {
      if (!TYPES.includes(file.type)) {
        toast.error(`${file.name}: only JPEG, PNG or WebP images`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: larger than 5 MB`);
        continue;
      }
      if (accepted.length >= room) {
        toast.error(`You can add up to ${MAX_TOTAL} photos in total`);
        break;
      }
      accepted.push({ file, url: URL.createObjectURL(file) });
    }
    setFiles((f) => [...f, ...accepted]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const moveExisting = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= existing.length) return;
    const next = [...existing];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    setExisting(next);
    orderChanged.current = true;
  };

  const confirmDeletePhoto = async () => {
    if (!deletePhoto || !listing) return;
    setDeletingPhoto(true);
    try {
      await api.delete(`/listings/${listing.id}/photos/${deletePhoto.id}`);
      setExisting((p) => p.filter((x) => x.id !== deletePhoto.id));
      toast.success("Photo removed");
      setDeletePhoto(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeletingPhoto(false);
    }
  };

  const validate = () => {
    const v: Record<string, string> = {};
    if (form.title.trim().length < 3) v.title = "Give your listing a title (3+ characters)";
    if (form.description.trim().length < 20) v.description = "Describe the place in at least 20 characters";
    if (form.location.trim().length < 2) v.location = "Which city is it in?";
    if (!form.rent || Number(form.rent) < 500) v.rent = "Enter the monthly rent";
    if (!form.availableFrom) v.availableFrom = "When is it available?";
    return v;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) {
      toast.error("Please fix the highlighted fields");
      document.getElementById(Object.keys(v)[0]!)?.focus();
      return;
    }

    const fd = new FormData();
    const fields: (keyof FormState)[] = [
      "title", "description", "location", "locality", "address", "rent", "deposit", "availableFrom", "roomType",
      "furnishingStatus", "maxOccupants", "genderPreference", "smokingAllowed", "petsAllowed", "foodPolicy",
      "householdSleepSchedule", "householdCleanliness",
    ];
    for (const k of fields) fd.append(k, String(form[k]).trim());
    fd.append("amenities", JSON.stringify(form.amenities));
    fd.append("rules", JSON.stringify(form.rules));
    if (editing && orderChanged.current) fd.append("photoOrder", JSON.stringify(existing.map((p) => p.id)));
    files.forEach((f) => fd.append("photos", f.file));

    setSaving(true);
    try {
      const res = editing
        ? await api.put<{ listing: Listing }>(`/listings/${listing!.id}`, fd)
        : await api.post<{ listing: Listing }>("/listings", fd);
      toast.success(editing ? "Listing updated" : "Listing published", {
        description: editing ? undefined : "Tenants who match will be notified.",
      });
      router.push(editing ? "/dashboard/listings" : `/listings/${res.data!.listing.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, m]) => [k, m[0]])));
      }
      toast.error(errorMessage(err, "Could not save listing"));
    } finally {
      setSaving(false);
    }
  };

  const triSelect = (id: "smokingAllowed" | "petsAllowed", label: string) => (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={form[id]} onChange={(e) => set(id, e.target.value as TriState)}>
        <option value="">Not specified</option>
        <option value="true">Allowed</option>
        <option value="false">Not allowed</option>
      </Select>
    </Field>
  );

  const totalPhotos = existing.length + files.length;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Section title="Basics" description="A clear title and an honest description get the best responses.">
        <div className="space-y-5">
          <Field label="Title" htmlFor="title" error={errors.title}>
            <Input id="title" maxLength={120} placeholder="e.g. Sunlit single room near Andheri metro" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description} hint={`${form.description.length}/5000`}>
            <Textarea id="description" rows={6} maxLength={5000} placeholder="What's the room like? Who lives there? What's nearby?" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Location">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City" htmlFor="location" error={errors.location}>
            <Input id="location" placeholder="e.g. Mumbai" value={form.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Locality / neighbourhood" htmlFor="locality" optional error={errors.locality}>
            <Input id="locality" placeholder="e.g. Andheri West" value={form.locality} onChange={(e) => set("locality", e.target.value)} />
          </Field>
          <Field label="Address" htmlFor="address" optional hint="Shown on the listing — avoid flat numbers if you prefer." className="sm:col-span-2" error={errors.address}>
            <Input id="address" placeholder="Street, area, PIN code" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Pricing & availability">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Monthly rent (₹)" htmlFor="rent" error={errors.rent}>
            <Input id="rent" inputMode="numeric" value={form.rent} onChange={(e) => set("rent", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Security deposit (₹)" htmlFor="deposit" optional error={errors.deposit}>
            <Input id="deposit" inputMode="numeric" value={form.deposit} onChange={(e) => set("deposit", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Available from" htmlFor="availableFrom" error={errors.availableFrom}>
            <Input id="availableFrom" type="date" value={form.availableFrom} onChange={(e) => set("availableFrom", e.target.value)} />
          </Field>
          <Field label="Max occupants" htmlFor="maxOccupants" error={errors.maxOccupants}>
            <Input id="maxOccupants" type="number" min={1} max={20} value={form.maxOccupants} onChange={(e) => set("maxOccupants", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="The room">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Room type" htmlFor="roomType">
            <Select id="roomType" value={form.roomType} onChange={(e) => set("roomType", e.target.value)}>
              {Object.entries(ROOM_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Furnishing" htmlFor="furnishingStatus">
            <Select id="furnishingStatus" value={form.furnishingStatus} onChange={(e) => set("furnishingStatus", e.target.value)}>
              {Object.entries(FURNISHING_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Flatmate preference" htmlFor="genderPreference" hint="For shared homes only.">
            <Select id="genderPreference" value={form.genderPreference} onChange={(e) => set("genderPreference", e.target.value)}>
              {Object.entries(GENDER_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">Amenities</p>
          <div className="flex flex-wrap gap-2">
            {[...new Set([...AMENITIES, ...form.amenities])].map((a) => (
              <Chip key={a} selected={form.amenities.includes(a)} onClick={() => toggle("amenities", a)}>{humanize(a)}</Chip>
            ))}
          </div>
          <div className="mt-3 flex max-w-sm gap-2">
            <label htmlFor="customAmenity" className="sr-only">Add amenity</label>
            <Input id="customAmenity" placeholder="Add another amenity" value={customAmenity} onChange={(e) => setCustomAmenity(e.target.value)} className="h-10" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Add amenity"
              onClick={() => {
                const v = customAmenity.trim().toLowerCase().replace(/\s+/g, "-");
                if (v && !form.amenities.includes(v)) set("amenities", [...form.amenities, v]);
                setCustomAmenity("");
              }}
            >
              <Plus />
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Household & rules" description="Used in tenant compatibility scores. Leave anything you're unsure about as “Not specified”.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {triSelect("smokingAllowed", "Smoking")}
          {triSelect("petsAllowed", "Pets")}
          <Field label="Kitchen" htmlFor="foodPolicy">
            <Select id="foodPolicy" value={form.foodPolicy} onChange={(e) => set("foodPolicy", e.target.value)}>
              <option value="">Not specified</option>
              {Object.entries(FOOD_LABEL).map(([k, l]) => <option key={k} value={k}>{k === "NO_PREFERENCE" ? "No restrictions" : `${l} only`}</option>)}
            </Select>
          </Field>
          <Field label="Household rhythm" htmlFor="householdSleepSchedule">
            <Select id="householdSleepSchedule" value={form.householdSleepSchedule} onChange={(e) => set("householdSleepSchedule", e.target.value)}>
              <option value="">Not specified</option>
              {Object.entries(SLEEP_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Cleanliness" htmlFor="householdCleanliness">
            <Select id="householdCleanliness" value={form.householdCleanliness} onChange={(e) => set("householdCleanliness", e.target.value)}>
              <option value="">Not specified</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} · {CLEANLINESS_LABEL[n]}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">House rules</p>
          <div className="flex flex-wrap gap-2">
            {[...new Set([...COMMON_RULES, ...form.rules])].map((r) => (
              <Chip key={r} selected={form.rules.includes(r)} onClick={() => toggle("rules", r)}>{humanize(r)}</Chip>
            ))}
          </div>
          <div className="mt-3 flex max-w-sm gap-2">
            <label htmlFor="customRule" className="sr-only">Add rule</label>
            <Input id="customRule" placeholder="Add a house rule" value={customRule} onChange={(e) => setCustomRule(e.target.value)} className="h-10" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Add rule"
              onClick={() => {
                const v = customRule.trim().toLowerCase().replace(/\s+/g, "-");
                if (v && !form.rules.includes(v)) set("rules", [...form.rules, v]);
                setCustomRule("");
              }}
            >
              <Plus />
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Photos" description={`JPEG, PNG or WebP · up to 5 MB each · ${totalPhotos}/${MAX_TOTAL} used. The first photo is the cover.`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {existing.map((p, i) => (
            <div key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted">
              <ListingImage src={p.url} alt={p.altText ?? `Photo ${i + 1}`} fill sizes="200px" />
              {i === 0 && <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">Cover</span>}
              <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveExisting(i, -1)} disabled={i === 0} className="grid size-8 place-items-center rounded-lg bg-white/90 text-stone-900 disabled:opacity-40" aria-label="Move photo earlier">
                    <ArrowLeft className="size-4" />
                  </button>
                  <button type="button" onClick={() => moveExisting(i, 1)} disabled={i === existing.length - 1} className="grid size-8 place-items-center rounded-lg bg-white/90 text-stone-900 disabled:opacity-40" aria-label="Move photo later">
                    <ArrowRight className="size-4" />
                  </button>
                </div>
                <button type="button" onClick={() => setDeletePhoto(p)} className="grid size-8 place-items-center rounded-lg bg-white/90 text-destructive" aria-label="Delete photo">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
          {files.map((f, i) => (
            <div key={f.url} className="relative aspect-[4/3] overflow-hidden rounded-xl border-2 border-dashed border-primary/50 bg-muted">
              <img src={f.url} alt={`New photo ${i + 1}`} className="size-full object-cover" />
              <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">New</span>
              <button
                type="button"
                onClick={() => setFiles((list) => list.filter((x) => x.url !== f.url))}
                className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/90 text-stone-900"
                aria-label="Remove new photo"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          {totalPhotos < MAX_TOTAL && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <ImagePlus className="size-6" />
              Add photos
            </button>
          )}
        </div>
        <input ref={fileInput} type="file" accept={TYPES.join(",")} multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} aria-label="Upload photos" />
        {errors.photos && <p className="mt-2 text-xs font-medium text-destructive">{errors.photos}</p>}
      </Section>

      <div className="sticky bottom-0 z-10 -mx-1 flex justify-end gap-3 border-t border-border/70 bg-background/85 px-1 py-4 backdrop-blur-md">
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()} className="bg-card">
          Cancel
        </Button>
        <Button type="submit" size="lg" loading={saving}>
          {editing ? "Save changes" : "Publish listing"}
        </Button>
      </div>

      <ConfirmDialog
        open={Boolean(deletePhoto)}
        onOpenChange={(o) => !o && setDeletePhoto(null)}
        title="Delete this photo?"
        description="It will be removed from the listing immediately."
        confirmLabel="Delete photo"
        destructive
        loading={deletingPhoto}
        onConfirm={() => void confirmDeletePhoto()}
      />
    </form>
  );
}
