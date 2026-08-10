"use client";

import { useFormStatus } from "react-dom";

export default function UnsubscribeButton({
  label,
  accentColor,
  textColor,
}: {
  label?: string;
  accentColor?: string;
  textColor?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="min-h-11 w-full touch-manipulation rounded-lg px-4 py-3 text-sm font-medium transition-opacity disabled:opacity-60"
      style={{
        background: accentColor ?? "#363A3F",
        color: textColor ?? "#EDEEF0",
      }}
    >
      {pending ? "Cancelando inscrição…" : (label ?? "Cancelar inscrição")}
    </button>
  );
}
