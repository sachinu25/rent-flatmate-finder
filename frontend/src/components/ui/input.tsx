import * as React from "react";

import { cn } from "@/lib/utils";

export const fieldBase =
  "w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground shadow-[0_1px_0_hsl(var(--shadow-color)/0.03)] transition-colors placeholder:text-muted-foreground/80 hover:border-foreground/25 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/15";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={cn(fieldBase, "h-11", className)} ref={ref} {...props} />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea className={cn(fieldBase, "min-h-28 resize-y py-3 leading-relaxed", className)} ref={ref} {...props} />
  ),
);
Textarea.displayName = "Textarea";

/** Native select — fully accessible and mobile-friendly. */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        className={cn(fieldBase, "h-11 appearance-none pr-10", className)}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      >
        <path fill="currentColor" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
      </svg>
    </div>
  ),
);
Select.displayName = "Select";

export { Input, Select, Textarea };
