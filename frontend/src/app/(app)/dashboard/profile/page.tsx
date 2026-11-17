"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { KeyRound, PartyPopper, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Chip, PageHeader, Skeleton, Surface } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/auth-context";
import { ApiError, api, errorMessage, setAccessToken } from "@/lib/api";
import { changePassword, updateMe } from "@/lib/auth-api";
import {
  CLEANLINESS_LABEL,
  FOOD_LABEL,
  ROOM_SHARING_LABEL,
  SLEEP_LABEL,
  SMOKING_LABEL,
  WORK_LABEL,
} from "@/lib/format";
import type { TenantProfile } from "@/lib/types";

type ProfileForm = {
  preferredLocation: string;
  budgetMin: string;
  budgetMax: string;
  moveInDate: string;
  occupation: string;
  bio: string;
  lifestyle: string;
  cleanliness: number | null;
  sleepSchedule: string | null;
  workSchedule: string | null;
  foodPreference: string | null;
  smoking: string | null;
  hasPets: boolean | null;
  roomSharing: string | null;
};

const emptyProfile: ProfileForm = {
  preferredLocation: "",
  budgetMin: "",
  budgetMax: "",
  moveInDate: "",
  occupation: "",
  bio: "",
  lifestyle: "",
  cleanliness: null,
  sleepSchedule: null,
  workSchedule: null,
  foodPreference: null,
  smoking: null,
  hasPets: null,
  roomSharing: null,
};

function fromProfile(p: TenantProfile): ProfileForm {
  return {
    preferredLocation: p.preferredLocation,
    budgetMin: String(p.budgetMin),
    budgetMax: String(p.budgetMax),
    moveInDate: p.moveInDate.slice(0, 10),
    occupation: p.occupation ?? "",
    bio: p.bio ?? "",
    lifestyle: p.lifestyle ?? "",
    cleanliness: p.cleanliness,
    sleepSchedule: p.sleepSchedule,
    workSchedule: p.workSchedule,
    foodPreference: p.foodPreference,
    smoking: p.smoking,
    hasPets: p.hasPets,
    roomSharing: p.roomSharing,
  };
}

function ChoiceRow<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={String(o.value)} selected={value === o.value} onClick={() => onChange(value === o.value ? null : o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

const opts = <K extends string>(labels: Record<K, string>) => (Object.entries(labels) as [K, string][]).map(([value, label]) => ({ value, label }));

function TenantPreferences() {
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const router = useRouter();

  useEffect(() => {
    api
      .get<{ profile: TenantProfile | null }>("/profile")
      .then((r) => r.data?.profile && setForm(fromProfile(r.data.profile)))
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (form.preferredLocation.trim().length < 2) v.preferredLocation = "Where do you want to live?";
    if (!form.budgetMax) v.budgetMax = "Set a maximum budget";
    if (form.budgetMin && form.budgetMax && Number(form.budgetMin) > Number(form.budgetMax)) v.budgetMax = "Must be at least the minimum";
    if (!form.moveInDate) v.moveInDate = "When do you want to move in?";
    setErrors(v);
    if (Object.keys(v).length) return;

    setSaving(true);
    try {
      await api.post("/profile", {
        ...form,
        budgetMin: Number(form.budgetMin || 0),
        budgetMax: Number(form.budgetMax),
      });
      toast.success("Preferences saved", { description: "Your compatibility scores will update automatically." });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, m]) => [k, m[0]])));
      toast.error(errorMessage(err, "Could not save preferences"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-[40rem] rounded-2xl" />;

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <Surface className="p-6 sm:p-8">
        <h2 className="text-lg font-bold">Housing preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">The biggest drivers of your compatibility score.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Preferred city or area" htmlFor="loc" error={errors.preferredLocation} className="sm:col-span-2">
            <Input id="loc" placeholder="e.g. Mumbai or Andheri West" value={form.preferredLocation} onChange={(e) => set("preferredLocation", e.target.value)} />
          </Field>
          <Field label="Minimum budget (₹/month)" htmlFor="bmin" error={errors.budgetMin}>
            <Input id="bmin" inputMode="numeric" placeholder="5000" value={form.budgetMin} onChange={(e) => set("budgetMin", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Maximum budget (₹/month)" htmlFor="bmax" error={errors.budgetMax}>
            <Input id="bmax" inputMode="numeric" placeholder="15000" value={form.budgetMax} onChange={(e) => set("budgetMax", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Move-in date" htmlFor="movein" error={errors.moveInDate}>
            <Input id="movein" type="date" value={form.moveInDate} onChange={(e) => set("moveInDate", e.target.value)} />
          </Field>
          <Field label="Occupation" htmlFor="occ" optional>
            <Input id="occ" placeholder="e.g. Software engineer" value={form.occupation} onChange={(e) => set("occupation", e.target.value)} />
          </Field>
          <Field label="About you" htmlFor="bio" optional hint="Shown to owners when you send a request." className="sm:col-span-2">
            <Textarea id="bio" maxLength={2000} rows={4} value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="A few lines about your routine, interests and what you're looking for." />
          </Field>
        </div>
      </Surface>

      <Surface className="p-6 sm:p-8">
        <h2 className="text-lg font-bold">Lifestyle</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All optional. Anything you skip is left out of your score rather than guessed. Tap a selected option again to clear it.
        </p>
        <div className="mt-6 space-y-6">
          <ChoiceRow
            label="How tidy are you?"
            options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} · ${CLEANLINESS_LABEL[n]}` }))}
            value={form.cleanliness}
            onChange={(v) => set("cleanliness", v)}
          />
          <ChoiceRow label="Sleep schedule" options={opts(SLEEP_LABEL)} value={form.sleepSchedule} onChange={(v) => set("sleepSchedule", v)} />
          <ChoiceRow label="Work schedule" options={opts(WORK_LABEL)} value={form.workSchedule} onChange={(v) => set("workSchedule", v)} />
          <ChoiceRow label="Food" options={opts(FOOD_LABEL)} value={form.foodPreference} onChange={(v) => set("foodPreference", v)} />
          <ChoiceRow label="Smoking" options={opts(SMOKING_LABEL)} value={form.smoking} onChange={(v) => set("smoking", v)} />
          <ChoiceRow
            label="Do you have pets?"
            options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]}
            value={form.hasPets}
            onChange={(v) => set("hasPets", v)}
          />
          <ChoiceRow label="Room preference" options={opts(ROOM_SHARING_LABEL)} value={form.roomSharing} onChange={(v) => set("roomSharing", v)} />
          <Field label="Anything else?" htmlFor="lifestyle" optional hint="Free text the AI analysis takes into account.">
            <Textarea id="lifestyle" rows={3} maxLength={500} value={form.lifestyle} onChange={(e) => set("lifestyle", e.target.value)} placeholder="e.g. I cook most evenings and practise guitar on weekends." />
          </Field>
        </div>
      </Surface>

      <div className="sticky bottom-0 z-10 -mx-1 flex justify-end border-t border-border/70 bg-background/85 px-1 py-4 backdrop-blur-md">
        <Button type="submit" size="lg" loading={saving}>Save preferences</Button>
      </div>
    </form>
  );
}

function AccountCard() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ firstName: user?.firstName ?? "", lastName: user?.lastName ?? "", phone: user?.phone ?? "" });
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateMe({ firstName: form.firstName, lastName: form.lastName, phone: form.phone || null });
      if (res.data) setUser(res.data.user);
      toast.success("Account updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSaving(true);
    try {
      const res = await changePassword(pw);
      if (res.data?.accessToken) setAccessToken(res.data.accessToken);
      setPw({ currentPassword: "", newPassword: "" });
      toast.success("Password changed", { description: "Other devices have been signed out." });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Surface className="p-6">
        <div className="flex items-center gap-2">
          <UserRound className="size-5 text-primary" />
          <h2 className="font-bold">Account</h2>
        </div>
        <form onSubmit={save} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="fn">
              <Input id="fn" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </Field>
            <Field label="Last name" htmlFor="ln">
              <Input id="ln" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Field>
          </div>
          <Field label="Email" htmlFor="em" hint="Contact support to change your email.">
            <Input id="em" value={user?.email ?? ""} disabled />
          </Field>
          <Field label="Phone" htmlFor="ph" optional>
            <Input id="ph" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Button type="submit" variant="outline" loading={saving} className="w-full">Save account</Button>
        </form>
      </Surface>

      <Surface className="p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          <h2 className="font-bold">Password</h2>
        </div>
        <form onSubmit={savePw} className="mt-5 space-y-4">
          <Field label="Current password" htmlFor="cpw">
            <Input id="cpw" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </Field>
          <Field label="New password" htmlFor="npw" hint="8+ characters with upper, lower case and a number.">
            <Input id="npw" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          </Field>
          <Button type="submit" variant="outline" loading={pwSaving} disabled={!pw.currentPassword || !pw.newPassword} className="w-full">
            Change password
          </Button>
        </form>
      </Surface>
    </div>
  );
}

function ProfileContent() {
  const { user } = useAuth();
  const welcome = useSearchParams().get("welcome") === "1";
  const isTenant = user?.role === "TENANT";

  return (
    <>
      <PageHeader
        title={isTenant ? "Profile & preferences" : "Account settings"}
        description={isTenant ? "Better answers mean better matches." : "Manage your account details."}
      />
      {welcome && isTenant && (
        <Surface className="mb-6 flex items-start gap-4 border-highlight/30 bg-highlight-soft p-5">
          <PartyPopper className="size-6 shrink-0 text-highlight" aria-hidden />
          <div>
            <p className="font-semibold">Welcome aboard!</p>
            <p className="text-sm text-muted-foreground">Add your preferences below and we&apos;ll start scoring every home for you.</p>
          </div>
        </Surface>
      )}
      <div className={isTenant ? "grid gap-6 lg:grid-cols-[1fr_20rem]" : "max-w-xl"}>
        {isTenant && <TenantPreferences />}
        <div>
          <AccountCard />
        </div>
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileContent />
    </Suspense>
  );
}
