"use client";

/**
 * Barra de faixas da taxa de retorno. O estado nunca é comunicado só por cor:
 * há rótulo textual dos limiares e valor acessível via aria.
 */
export function ReputationGauge({
  value,
  warning,
  critical,
  block,
}: {
  value: number;
  warning: number;
  critical: number;
  block: number;
}) {
  // A escala vai até 1,5x o limite de bloqueio para o marcador não colar na
  // borda quando a conta estiver muito acima.
  const max = Math.max(block * 1.5, value * 1.1);
  const pos = (n: number) => `${Math.min(100, (n / max) * 100)}%`;

  return (
    <div>
      <div
        className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={Number(value.toFixed(2))}
        aria-valuemin={0}
        aria-valuemax={Number(max.toFixed(2))}
        aria-label={`Taxa de retorno: ${value.toFixed(2)}%. Limite de bloqueio: ${block}%.`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-success/30"
          style={{ width: pos(warning) }}
        />
        <div
          className="absolute inset-y-0 bg-warning/30"
          style={{ left: pos(warning), width: pos(critical - warning) }}
        />
        <div
          className="absolute inset-y-0 bg-destructive/20"
          style={{ left: pos(critical), width: pos(block - critical) }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-destructive/40"
          style={{ left: pos(block) }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: pos(value) }}
          aria-hidden
        />
      </div>

      <div className="mt-2 flex justify-between font-mono text-xs text-muted-foreground">
        <span>0%</span>
        <span>alerta {warning}%</span>
        <span>crítico {critical}%</span>
        <span>bloqueio {block}%</span>
      </div>
    </div>
  );
}
