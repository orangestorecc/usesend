import { useEffect, useState } from "react";
import { cn } from "@usesend/ui/lib/utils";

/** Campo de cor: amostra clicável + hex editável. */
export function ColorField({
  label,
  value,
  onChange,
  placeholder = "#ffffff",
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const hex = toHex(value);
  const [text, setText] = useState(hex ?? value ?? "");
  useEffect(() => setText(toHex(value) ?? value ?? ""), [value]);

  const commit = (v: string) => {
    const t = v.trim();
    // Só propaga hex válido — evita gravar lixo enquanto a pessoa digita.
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t)) onChange(t);
    else if (t === "") onChange("");
  };

  return (
    <Row label={label}>
      <div className="flex h-8 flex-1 items-center gap-2 rounded-md bg-muted px-2">
        <label className="relative h-4 w-4 shrink-0 cursor-pointer overflow-hidden rounded border">
          <span
            className="absolute inset-0"
            style={{ backgroundColor: value || placeholder }}
          />
          <input
            type="color"
            value={hex || placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <input
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit(text)}
          className="w-full bg-transparent font-mono text-xs outline-none"
        />
      </div>
    </Row>
  );
}

/**
 * Normaliza para hex. Vários blocos guardam cor como `rgb(0, 0, 0)` (default
 * histórico das extensões) e `<input type="color">` só aceita `#rrggbb`.
 */
export function toHex(v?: string): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    return `#${t
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("")}`.toLowerCase();
  }
  const m = t.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return undefined;
  return `#${m
    .slice(1, 4)
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Campo de texto de uma linha. */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  return (
    <Row label={label}>
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(text)}
        onKeyDown={(e) => e.key === "Enter" && onChange(text)}
        className="h-8 flex-1 rounded-md bg-muted px-2 text-xs outline-none"
      />
    </Row>
  );
}

/** Campo de texto multilinha; commita ao sair do foco. */
export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label?: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  return (
    <div className="space-y-1.5">
      {label ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : null}
      <textarea
        value={text}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(text)}
        className="w-full rounded-md bg-muted p-2 font-mono text-xs outline-none"
      />
    </div>
  );
}

/** Select simples com as opções dadas. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <Row label={label}>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 flex-1 rounded-md bg-muted px-2 text-xs outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

const UNITS = ["px", "%"] as const;
export type Unit = (typeof UNITS)[number];

/** Número + unidade (px/%). Devolve string CSS pronta ("600px"). */
export function NumberUnitField({
  label,
  value,
  onChange,
  placeholder = "auto",
  allowUnits = true,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  allowUnits?: boolean;
}) {
  const parsed = parseCssLength(value);
  const [num, setNum] = useState(parsed.num);
  useEffect(() => setNum(parseCssLength(value).num), [value]);

  const commit = (n: string, u: Unit) => {
    const t = n.trim();
    if (t === "") return onChange("");
    const v = Number(t);
    if (Number.isNaN(v)) return;
    onChange(`${v}${u}`);
  };

  return (
    <Row label={label}>
      <div className="flex h-8 flex-1 items-center rounded-md bg-muted">
        <input
          value={num}
          placeholder={placeholder}
          inputMode="numeric"
          onChange={(e) => setNum(e.target.value)}
          onBlur={() => commit(num, parsed.unit)}
          onKeyDown={(e) => e.key === "Enter" && commit(num, parsed.unit)}
          className="w-full bg-transparent px-2 font-mono text-xs outline-none"
        />
        {allowUnits ? (
          <select
            value={parsed.unit}
            onChange={(e) => commit(num, e.target.value as Unit)}
            className="h-8 shrink-0 rounded-r-md bg-transparent pr-1 text-xs text-muted-foreground outline-none"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        ) : (
          <span className="shrink-0 pr-2 text-xs text-muted-foreground">px</span>
        )}
      </div>
    </Row>
  );
}

export function parseCssLength(v?: string): { num: string; unit: Unit } {
  if (!v) return { num: "", unit: "px" };
  const m = String(v).match(/^(-?[\d.]+)(px|%)?$/);
  if (!m) return { num: "", unit: "px" };
  return { num: m[1] ?? "", unit: (m[2] as Unit) ?? "px" };
}

/** Controle segmentado (ex: alinhamento). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: React.ReactNode; title?: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-md bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-7 flex-1 items-center justify-center rounded transition-colors",
            value === o.value
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[92px] shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export function PanelSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5 px-4 py-3">
      {title ? (
        <div className="text-xs font-semibold text-foreground">{title}</div>
      ) : null}
      {children}
    </div>
  );
}
