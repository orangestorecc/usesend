"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";

import { Badge } from "@usesend/ui/src/badge";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { toast } from "@usesend/ui/src/toaster";
import Spinner from "@usesend/ui/src/spinner";

import { api } from "~/trpc/react";

export default function AdminsDaPlataformaPage() {
  const [email, setEmail] = useState("");

  const utils = api.useUtils();
  const { data: admins, isLoading } =
    api.admin.listarAdminsDaPlataforma.useQuery();

  const invalidar = () =>
    void utils.admin.listarAdminsDaPlataforma.invalidate();

  const promover = api.admin.promoverAdminDaPlataforma.useMutation({
    onSuccess: () => {
      toast.success("Acesso de admin concedido");
      setEmail("");
      invalidar();
    },
    onError: (e) => toast.error(e.message),
  });

  const remover = api.admin.removerAdminDaPlataforma.useMutation({
    onSuccess: () => {
      toast.success("Acesso de admin removido");
      invalidar();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Admins da plataforma
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Quem entra aqui enxerga <strong>todos os clientes</strong>: times,
          faturamento, e-mails enviados e configurações de envio. É diferente de
          admin de workspace, que só manda no próprio time.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="e-mail da conta"
          value={email}
          type="email"
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && email.trim()) {
              promover.mutate({ email: email.trim() });
            }
          }}
          className="max-w-sm"
        />
        <Button
          onClick={() => promover.mutate({ email: email.trim() })}
          disabled={!email.trim() || promover.isPending}
        >
          Dar acesso de admin
        </Button>
      </div>
      <p className="-mt-4 text-xs text-muted-foreground">
        A pessoa precisa já ter entrado no Madmail ao menos uma vez — o acesso é
        dado a uma conta existente.
      </p>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead className="w-[260px]">E-mail</TableHead>
              <TableHead className="w-[150px]">Conta criada</TableHead>
              <TableHead className="w-[160px]">Origem</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center">
                  <Spinner className="mx-auto h-5 w-5" />
                </TableCell>
              </TableRow>
            ) : !admins || admins.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhum admin cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="text-sm">
                    {admin.name ?? "—"}
                  </TableCell>
                  <TableCell className="break-all text-sm">
                    {admin.email}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(admin.createdAt), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    {admin.viaEnv ? (
                      <Badge variant="secondary" className="font-normal">
                        ADMIN_EMAIL
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        concedido aqui
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {admin.viaEnv ? null : (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Remover acesso de admin"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remover o acesso de admin da plataforma de ${admin.email}?`,
                            )
                          ) {
                            remover.mutate({ userId: admin.id });
                          }
                        }}
                        disabled={remover.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Quem está como <strong>ADMIN_EMAIL</strong> vem do arquivo de
        configuração do servidor e não pode ser removido por aqui — é a
        salvaguarda que impede a plataforma de ficar sem nenhum admin.
      </p>
    </div>
  );
}
