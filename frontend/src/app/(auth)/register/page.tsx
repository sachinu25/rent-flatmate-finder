"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Check, Eye, EyeOff, Home, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { ApiError, errorMessage } from "@/lib/api";
import { cn, homeFor, safeNext } from "@/lib/utils";

type Role = "TENANT" | "OWNER";
type Errors = Partial<Record<"firstName" | "lastName" | "email" | "password" | "confirm" | "phone" | "form", string>>;

const RULES = [
  { test: (p: string) => p.length >= 8, label: "8+ characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "Uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "Lowercase letter" },
  { test: (p: string) => /[0-9]/.test(p), label: "Number" },
];

function RegisterForm() {
  const { register, user, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [role, setRole] = useState<Role>(params.get("role") === "OWNER" ? "OWNER" : "TENANT");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!isLoading && user) router.replace(homeFor(user.role));
  }, [isLoading, user, router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = (): Errors => {
    const v: Errors = {};
    if (!form.firstName.trim()) v.firstName = "Required";
    if (!form.lastName.trim()) v.lastName = "Required";
    if (!/\S+@\S+\.\S+/.test(form.email)) v.email = "Enter a valid email address";
    if (form.phone && !/^\+?[0-9 ()-]{7,20}$/.test(form.phone)) v.phone = "Enter a valid phone number";
    if (!RULES.every((r) => r.test(form.password))) v.password = "Password doesn't meet the requirements";
    if (form.password !== form.confirm) v.confirm = "Passwords don't match";
    return v;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      const u = await register({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role,
        phone: form.phone.trim() || undefined,
      });
      toast.success(`Welcome, ${u.firstName}!`);
      router.replace(safeNext(next, role === "TENANT" ? "/dashboard/profile?welcome=1" : "/dashboard/listings/new"));
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setErrors({
          email: err.field("email"),
          password: err.field("password"),
          firstName: err.field("firstName"),
          lastName: err.field("lastName"),
          phone: err.field("phone"),
        });
      } else {
        setErrors({ form: errorMessage(err, "Registration failed") });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1 className="text-3xl font-bold">Create your account</h1>
      <p className="mt-2 text-muted-foreground">Free for tenants and owners.</p>

      <div className="mt-7 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
        {(
          [
            { value: "TENANT", title: "I'm looking", sub: "for a room or flatmate", icon: Search },
            { value: "OWNER", title: "I'm listing", sub: "a room or property", icon: Home },
          ] as const
        ).map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={role === o.value}
            onClick={() => setRole(o.value)}
            className={cn(
              "rounded-2xl border p-4 text-left transition-all",
              role === o.value ? "border-primary bg-primary-soft ring-4 ring-primary/10" : "border-border bg-card hover:border-foreground/30",
            )}
          >
            <o.icon className={cn("size-5", role === o.value ? "text-primary" : "text-muted-foreground")} />
            <p className="mt-3 text-sm font-semibold">{o.title}</p>
            <p className="text-xs text-muted-foreground">{o.sub}</p>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {errors.form && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
            {errors.form}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="firstName" error={errors.firstName}>
            <Input id="firstName" autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />
          </Field>
          <Field label="Last name" htmlFor="lastName" error={errors.lastName}>
            <Input id="lastName" autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
          </Field>
        </div>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone} optional hint="Never shown publicly.">
          <Input id="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={set("password")} className="pr-11" />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <ul className="grid grid-cols-2 gap-1.5" aria-label="Password requirements">
          {RULES.map((r) => {
            const ok = r.test(form.password);
            return (
              <li key={r.label} className={cn("flex items-center gap-1.5 text-xs", ok ? "text-success" : "text-muted-foreground")}>
                <span className={cn("grid size-4 place-items-center rounded-full", ok ? "bg-success/15" : "bg-secondary")}>
                  {ok && <Check className="size-3" />}
                </span>
                {r.label}
              </li>
            );
          })}
        </ul>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}>
          <Input id="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Create {role === "TENANT" ? "tenant" : "owner"} account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
      </p>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
