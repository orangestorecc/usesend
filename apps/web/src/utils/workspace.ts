/** Rota que grava o workspace ativo no cookie (validada no servidor). */
export const ROTA_SELECIONAR_WORKSPACE = "/api/workspace/select";

/**
 * Troca o workspace ativo.
 *
 * O cookie é escrito pelo servidor, então não adianta atualizar só o estado do
 * React: depois de trocar, a página é recarregada de propósito para que todo
 * dado já venha do time novo. Meia troca (menu novo, dados velhos) é pior do
 * que troca nenhuma.
 */
export async function trocarWorkspace(
  teamId: number,
  destino = "/dashboard",
): Promise<void> {
  const resposta = await fetch(ROTA_SELECIONAR_WORKSPACE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId }),
  });

  if (!resposta.ok) {
    // 401 é sessão expirada: insistir no botão nunca vai funcionar. Manda para
    // o login guardando o destino, em vez de deixar a pessoa tentando para
    // sempre uma ação que só o relogin resolve.
    if (resposta.status === 401) {
      const volta = encodeURIComponent(window.location.pathname);
      window.location.assign(`/login?callbackUrl=${volta}`);
      throw new Error("Sua sessão expirou. Entre de novo para continuar.");
    }

    // O servidor distingue os dois 403 ("não é membro" x "sessão presa a um
    // workspace por link de acesso") e só ele sabe qual é. Montar a mensagem
    // pelo status acusava de não pertencer justamente quem pertence.
    const corpo = (await resposta.json().catch(() => null)) as {
      error?: string;
    } | null;
    const doServidor = corpo?.error?.trim();

    throw new Error(
      doServidor && doServidor.length > 0
        ? doServidor
        : "Não foi possível trocar de workspace. Tente de novo.",
    );
  }

  window.location.assign(destino);
}
