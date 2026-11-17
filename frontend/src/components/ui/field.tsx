import * as React from "react";

import { cn } from "@/lib/utils";

import { Label } from "./label";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactElement<{ "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}

/** Label + control + hint/error, wired with aria attributes. */
export function Field({ label, htmlFor, error, hint, optional, className, children }: FieldProps) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {React.cloneElement(children, { "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
