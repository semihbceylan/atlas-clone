"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonVariant = "ghost" | "outline";
type IconButtonSize = "sm" | "md";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; also used as the native tooltip. */
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  /** Renders the pressed/highlighted treatment for toggle buttons. */
  active?: boolean;
  size?: IconButtonSize;
}

const BASE =
  "inline-flex shrink-0 items-center justify-center rounded-md border transition-colors " +
  "outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent/50 " +
  "disabled:cursor-not-allowed disabled:opacity-40";

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost:
    "border-transparent text-terminal-muted hover:bg-terminal-hover hover:text-terminal-text",
  outline:
    "border-terminal-border bg-terminal-panel-alt text-terminal-muted hover:border-terminal-border-strong hover:text-terminal-text",
};

const SIZES: Record<IconButtonSize, string> = {
  sm: "size-6",
  md: "size-7",
};

const ACTIVE = "border-terminal-border-strong bg-terminal-elevated text-terminal-text";

/**
 * Compact square icon button used across the header and widget toolbars.
 *
 * Exists because the terminal has a dozen of these and their hover/pressed/
 * focus treatment has to stay identical everywhere — a single component is less
 * error-prone than repeating the same utility string in five files.
 */
export function IconButton({
  label,
  icon,
  variant = "ghost",
  active = false,
  size = "md",
  className = "",
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={`${BASE} ${SIZES[size]} ${active ? ACTIVE : VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
}
