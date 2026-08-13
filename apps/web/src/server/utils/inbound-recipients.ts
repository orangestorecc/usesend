/**
 * Destinatários reais da entrega. O header `To:` é escrito por quem envia e
 * pode apontar para qualquer lugar — quem manda é o envelope. O SES carimba o
 * destinatário do envelope no `Received` que ele mesmo adiciona (`for <...>`),
 * então é dali que sai o roteamento; `To`/`Cc` ficam só como último recurso
 * para mensagens sem esse carimbo.
 */
export function extrairDestinatariosDeEnvelope(
  headerReceived: string | string[] | undefined,
): string[] {
  const linhas = Array.isArray(headerReceived)
    ? headerReceived
    : headerReceived
      ? [headerReceived]
      : [];

  const destinos: string[] = [];
  for (const linha of linhas) {
    const m = /\bfor\s+<?([^\s<>;]+@[^\s<>;]+)>?/i.exec(linha);
    if (m?.[1]) destinos.push(m[1].toLowerCase());
  }
  return destinos;
}
