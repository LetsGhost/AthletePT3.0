import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

import { Spinner } from "./spinner";

const variants = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "bg-inset text-text border border-border-strong hover:border-text",
  ghost: "text-text hover:bg-inset",
  danger: "bg-danger text-white hover:opacity-90 dark:text-bg",
} as const;

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5",
  lg: "h-12 px-6 text-lg",
  icon: "h-11 w-11 p-0",
} as const;

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  /** Zeigt einen Spinner und sperrt den Button. */
  loading?: boolean;
  /** Rendert das Kind (z. B. einen Link) mit Button-Styling. */
  asChild?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  asChild = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-card font-medium tracking-wide",
    "transition-colors active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
