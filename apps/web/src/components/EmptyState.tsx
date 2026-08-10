import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Madmail empty state — a dashed hairline card with a framed icon, title,
 * supporting copy and an optional CTA. Monochrome; inherits theme tokens.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center ${className ?? ""}`}
    >
      {Icon ? (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <h4 className="text-[15px] font-semibold text-foreground">{title}</h4>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
