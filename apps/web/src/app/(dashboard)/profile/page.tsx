"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Badge } from "@usesend/ui/src/badge";
import { Spinner } from "@usesend/ui/src/spinner";
import { toast } from "@usesend/ui/src/toaster";

import { api } from "~/trpc/react";
import { AlterarEmail } from "./alterar-email";
import { MfaCard } from "./mfa-card";
import { ExcluirConta } from "./excluir-conta";
import { SairDoTime } from "./sair-do-time";
import { VincularConta } from "./vincular-conta";

/** Card com a mesma casca visual das settings. */
function Bloco({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-base font-medium">{titulo}</h2>
      {descricao ? (
        <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ProfilePage() {
  const utils = api.useUtils();
  const perfil = api.user.getProfile.useQuery();
  const sessoes = api.user.listSessions.useQuery();

  if (perfil.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (perfil.error || !perfil.data) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Não foi possível carregar seu perfil.{" "}
        <button className="underline" onClick={() => perfil.refetch()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  const { user, times, convites, contasVinculadas, trocaDeEmailEmAndamento } =
    perfil.data;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Meu Perfil</h1>

      <Bloco titulo="Seus dados">
        <NomeEditavel
          inicial={user.name ?? ""}
          onSalvo={() => utils.user.getProfile.invalidate()}
        />
        <div className="mt-4">
          <div className="text-sm text-muted-foreground">E-mail de acesso</div>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-sm">{user.email}</span>
            <AlterarEmail
              emailAtual={user.email ?? ""}
              temProvidersVinculados={contasVinculadas.length > 0}
              onTrocado={() => utils.user.getProfile.invalidate()}
            />
          </div>
          {user.pendingEmail ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Troca para {user.pendingEmail} aguardando confirmação.
            </p>
          ) : null}
          {trocaDeEmailEmAndamento?.revertDeadline ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Você pode reverter esta troca até{" "}
              {format(
                trocaDeEmailEmAndamento.revertDeadline,
                "dd/MM/yyyy, 'às' HH'h'mm",
              )}
              .
            </p>
          ) : null}
        </div>
      </Bloco>

      {convites.length > 0 ? (
        <Bloco titulo="Convites pendentes">
          <ul className="flex flex-col gap-2">
            {convites.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div>
                  <div className="text-sm">{c.time}</div>
                  <div className="text-xs capitalize text-muted-foreground">
                    {c.papel.toLowerCase()}
                  </div>
                </div>
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/join-team?inviteId=${c.id}`}>Ver convite</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Bloco>
      ) : null}

      <Bloco titulo="Workspaces">
        {times.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Você ainda não faz parte de nenhum workspace.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {times.map((t) => (
              <li
                key={t.teamId}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm">
                    {t.nome}
                    <Badge variant="secondary">
                      {t.papel === "ADMIN" ? "Admin" : "Membro"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Membro desde {format(t.membroDesde, "dd/MM/yyyy")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {t.papel === "ADMIN" ? (
                    <Button size="sm" variant="ghost" asChild>
                      <Link href="/settings/team">Gerenciar workspace →</Link>
                    </Button>
                  ) : null}
                  <SairDoTime
                    teamId={t.teamId}
                    nome={t.nome}
                    ultimoAdmin={t.ultimoAdmin}
                    onSaiu={() => utils.user.getProfile.invalidate()}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco
        titulo="Autenticação"
        descricao="Entrar por código no e-mail está sempre disponível."
      >
        <div className="flex flex-col gap-2">
          {["google", "github"].map((provider) => {
            const vinculada = contasVinculadas.some(
              (c) => c.provider === provider,
            );
            return (
              <div
                key={provider}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="text-sm capitalize">{provider}</span>
                <VincularConta
                  provider={provider}
                  vinculada={vinculada}
                  onMudou={() => utils.user.getProfile.invalidate()}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <div className="text-sm font-medium">Sessões ativas</div>
          {sessoes.isLoading ? (
            <div className="mt-2 text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {(sessoes.data ?? []).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <div className="text-sm">
                      {s.userAgent ?? "Dispositivo desconhecido"}
                      {s.atual ? (
                        <Badge variant="secondary" className="ml-2">
                          Esta sessão
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Desde {format(s.createdAt, "dd/MM/yyyy, 'às' HH'h'mm")}
                      {s.ip ? ` · ${s.ip}` : ""}
                    </div>
                  </div>
                  {!s.atual ? (
                    <EncerrarSessao sessionId={s.id} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <SairDeTodos />
        </div>
      </Bloco>

      <Bloco
        titulo="Confirmação por e-mail em logins sociais"
        descricao="Quando ligada, entrar pelo Google ou GitHub passa a exigir um código enviado ao seu e-mail. Protege a conta mesmo se a conta social for comprometida."
      >
        <MfaCard
          ativado={user.mfaEnabled}
          temProviderSocial={contasVinculadas.length > 0}
          onMudou={() => utils.user.getProfile.invalidate()}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Entrar por código no e-mail já é prova de posse da caixa — nesse caso
          nenhum segundo código é pedido. Passkeys e app autenticador estão no
          nosso roteiro.
        </p>
      </Bloco>

      <Bloco
        titulo="Zona de perigo"
        descricao="Excluir a conta remove seu acesso e seus vínculos com os workspaces."
      >
        <ExcluirConta />
      </Bloco>
    </div>
  );
}

function NomeEditavel({
  inicial,
  onSalvo,
}: {
  inicial: string;
  onSalvo: () => void;
}) {
  const [valor, setValor] = useState(inicial);
  const [salvo, setSalvo] = useState(false);
  const mutation = api.user.updateName.useMutation();

  function salvar() {
    const nome = valor.trim();
    // Campo esvaziado restaura o anterior em vez de apagar o nome.
    if (!nome) {
      setValor(inicial);
      return;
    }
    if (nome === inicial) return;

    mutation.mutate(
      { name: nome },
      {
        onSuccess: () => {
          setSalvo(true);
          setTimeout(() => setSalvo(false), 2000);
          onSalvo();
        },
        onError: (e) => {
          toast.error(e.message);
          setValor(inicial);
        },
      },
    );
  }

  return (
    <div>
      <label className="text-sm text-muted-foreground" htmlFor="perfil-nome">
        Nome
      </label>
      <div className="mt-1 flex items-center gap-2">
        <Input
          id="perfil-nome"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => {
            if (e.key === "Escape") setValor(inicial);
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="max-w-sm"
        />
        <span aria-live="polite" className="text-xs text-muted-foreground">
          {mutation.isPending ? "Salvando…" : salvo ? "Salvo ✓" : ""}
        </span>
      </div>
    </div>
  );
}

function EncerrarSessao({ sessionId }: { sessionId: string }) {
  const utils = api.useUtils();
  const mutation = api.user.revokeSession.useMutation({
    onSuccess: () => utils.user.listSessions.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate({ sessionId })}
    >
      Encerrar
    </Button>
  );
}

function SairDeTodos() {
  const utils = api.useUtils();
  const mutation = api.user.revokeAllSessions.useMutation({
    onSuccess: ({ encerradas }) => {
      toast.success(
        encerradas === 0
          ? "Nenhuma outra sessão estava aberta"
          : `${encerradas} sessão(ões) encerrada(s)`,
      );
      utils.user.listSessions.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Button
      size="sm"
      variant="ghost"
      className="mt-3"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      Sair de todos os outros dispositivos
    </Button>
  );
}
