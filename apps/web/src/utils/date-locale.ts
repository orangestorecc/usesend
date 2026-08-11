import { setDefaultOptions } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Define pt-BR como locale padrão do date-fns.
 *
 * Sem isto, `format(d, "dd MMM")` devolve "01 Aug" e `formatDistanceToNow`
 * devolve "2 days ago". Como o módulo roda no import, basta ser importado
 * uma vez em cada runtime (servidor e cliente) — ver `date-locale-setup.tsx`.
 */
setDefaultOptions({ locale: ptBR });

export { ptBR };
