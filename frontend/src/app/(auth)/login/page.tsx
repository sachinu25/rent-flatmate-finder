"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { ApiError, errorMessage } from "@/lib/api";
import { homeFor, safeNext } from "@/lib/utils";

function LoginForm() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  useEffect(() => {
    if (!isLoading && user) router.replace(safeNext(next, homeFor(user.role)));
  }, [isLoading, user, next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v: typeof errors = {};
    if (!/\S+@\S+\.\S+/.test(email)) v.email = "Enter a valid email address";
    if (!password) v.password = "Enter your password";
    setErrors(v);
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome back, ${u.firstName}!`);
      router.replace(safeNext(next, homeFor(u.role)));
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setErrors({ email: err.field("email"), password: err.field("password") });
      } else {
        setErrors({ form: errorMessage(err, "Sign in failed") });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Sign in to continue to your dashboard.</p>

      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        {errors.form && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
            {errors.form}
          </p>
        )}
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
            />
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
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
