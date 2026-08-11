"use client";

// Aplica o locale pt-BR do date-fns no bundle do cliente. O efeito acontece
// no import do módulo, então o componente em si não renderiza nada.
import "~/utils/date-locale";

export function DateLocaleSetup() {
  return null;
}
