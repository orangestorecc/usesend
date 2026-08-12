"use client";

import { useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import { toast } from "@usesend/ui/src/toaster";
import { Search } from "lucide-react";

import { api } from "~/trpc/react";
import PhoneInput from "~/components/phone-input";
import {
  documentoValido,
  emailValido,
  formatarCep,
  formatarDocumento,
  separarTelefone,
  soDigitos,
  telefoneParaArmazenar,
  telefoneValido,
  tipoDoDocumento,
} from "~/lib/validadores-br";

export type BillingContactData = {
  responsavel: string;
  email: string;
  whatsapp: string;
  documento: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

/**
 * Cadastro do responsável financeiro.
 *
 * Digitar CNPJ dispara a consulta na Receita e preenche razão social, nome
 * fantasia e endereço; digitar CEP preenche o resto do endereço. A ideia é
 * que o cliente digite o mínimo — cada campo a mais num checkout é uma
 * chance a mais de ele desistir.
 */
export default function BillingContactDialog({
  inicial,
  emailPadrao,
  onClose,
}: {
  inicial: BillingContactData | null;
  emailPadrao?: string | null;
  onClose: () => void;
}) {
  const telInicial = inicial ? separarTelefone(inicial.whatsapp) : null;

  const [responsavel, setResponsavel] = useState(inicial?.responsavel ?? "");
  const [email, setEmail] = useState(inicial?.email ?? emailPadrao ?? "");
  const [codigoPais, setCodigoPais] = useState(telInicial?.codigoPais ?? "BR");
  const [numeroTel, setNumeroTel] = useState(telInicial?.numero ?? "");
  const [documento, setDocumento] = useState(
    inicial?.documento ? formatarDocumento(inicial.documento) : "",
  );
  const [razaoSocial, setRazaoSocial] = useState(inicial?.razaoSocial ?? "");
  const [nomeFantasia, setNomeFantasia] = useState(inicial?.nomeFantasia ?? "");
  const [cep, setCep] = useState(inicial?.cep ? formatarCep(inicial.cep) : "");
  const [logradouro, setLogradouro] = useState(inicial?.logradouro ?? "");
  const [numero, setNumero] = useState(inicial?.numero ?? "");
  const [complemento, setComplemento] = useState(inicial?.complemento ?? "");
  const [bairro, setBairro] = useState(inicial?.bairro ?? "");
  const [cidade, setCidade] = useState(inicial?.cidade ?? "");
  const [uf, setUf] = useState(inicial?.uf ?? "");

  const utils = api.useUtils();
  const tipo = tipoDoDocumento(documento);

  const consultaCnpj = api.consulta.cnpj.useMutation({
    onSuccess: (d) => {
      setRazaoSocial(d.razaoSocial);
      if (d.nomeFantasia) setNomeFantasia(d.nomeFantasia);
      if (d.endereco.cep) setCep(formatarCep(d.endereco.cep));
      if (d.endereco.logradouro) setLogradouro(d.endereco.logradouro);
      if (d.endereco.numero) setNumero(d.endereco.numero);
      if (d.endereco.complemento) setComplemento(d.endereco.complemento);
      if (d.endereco.bairro) setBairro(d.endereco.bairro);
      if (d.endereco.cidade) setCidade(d.endereco.cidade);
      if (d.endereco.uf) setUf(d.endereco.uf);
      // Só preenche o que está vazio: o que a pessoa digitou vence a Receita.
      if (!email && d.email) setEmail(d.email);
      if (!numeroTel && d.telefone) {
        setNumeroTel(soDigitos(d.telefone));
        setCodigoPais("BR");
      }
      toast.success(
        d.situacao ? `Encontrado — situação: ${d.situacao}` : "Dados preenchidos",
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const consultaCep = api.consulta.cep.useMutation({
    onSuccess: (d) => {
      if (d.logradouro) setLogradouro(d.logradouro);
      if (d.bairro) setBairro(d.bairro);
      if (d.cidade) setCidade(d.cidade);
      if (d.uf) setUf(d.uf);
    },
    onError: (e) => toast.error(e.message),
  });

  const salvar = api.billingContact.upsert.useMutation({
    onSuccess: () => {
      toast.success("Dados de faturamento salvos.");
      utils.billingContact.get.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const erroEmail = email.trim() && !emailValido(email) ? "E-mail inválido" : null;
  const erroDocumento =
    documento.trim() && !documentoValido(documento)
      ? tipo === "cpf"
        ? "CPF inválido — confira os dígitos"
        : tipo === "cnpj"
          ? "CNPJ inválido — confira os dígitos"
          : "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)"
      : null;

  const podeSalvar =
    responsavel.trim().length >= 2 &&
    emailValido(email) &&
    telefoneValido(numeroTel, codigoPais) &&
    !erroDocumento;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Responsável financeiro</DialogTitle>
          <DialogDescription>
            Para onde vão a nota fiscal e os avisos de cobrança.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <Label>CPF ou CNPJ</Label>
            <div className="flex gap-2">
              <Input
                value={documento}
                onChange={(e) => setDocumento(formatarDocumento(e.target.value))}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => consultaCnpj.mutate({ cnpj: documento })}
                disabled={tipo !== "cnpj" || !!erroDocumento || consultaCnpj.isPending}
                title={
                  tipo === "cnpj"
                    ? "Buscar dados na Receita"
                    : "Disponível para CNPJ"
                }
              >
                <Search className="mr-1 h-4 w-4" />
                {consultaCnpj.isPending ? "Buscando..." : "Buscar"}
              </Button>
            </div>
            {erroDocumento ? (
              <p className="mt-1 text-xs text-destructive">{erroDocumento}</p>
            ) : tipo === "cnpj" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Clique em Buscar para preencher razão social e endereço
                automaticamente.
              </p>
            ) : null}
          </div>

          <div>
            <Label>
              {tipo === "cpf" ? "Nome completo" : "Razão social"}
            </Label>
            <Input
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder="Como deve sair na nota fiscal"
            />
          </div>

          {tipo === "cnpj" ? (
            <div>
              <Label>Nome fantasia</Label>
              <Input
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
              />
            </div>
          ) : null}

          <div className="border-t pt-4">
            <Label>Nome do responsável</Label>
            <Input
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Quem cuida do financeiro"
            />
          </div>

          <div>
            <Label>E-mail para cobrança</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="financeiro@suaempresa.com.br"
            />
            {erroEmail ? (
              <p className="mt-1 text-xs text-destructive">{erroEmail}</p>
            ) : null}
          </div>

          <div>
            <Label>WhatsApp</Label>
            <PhoneInput
              codigoPais={codigoPais}
              onCodigoPaisChange={setCodigoPais}
              numero={numeroTel}
              onNumeroChange={setNumeroTel}
            />
          </div>

          <div className="border-t pt-4">
            <p className="mb-3 text-xs text-muted-foreground">
              Endereço para a nota fiscal
            </p>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div>
                <Label>CEP</Label>
                <Input
                  value={cep}
                  onChange={(e) => setCep(formatarCep(e.target.value))}
                  onBlur={() => {
                    if (soDigitos(cep).length === 8) {
                      consultaCep.mutate({ cep });
                    }
                  }}
                  placeholder="00000-000"
                  inputMode="numeric"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => consultaCep.mutate({ cep })}
                  disabled={soDigitos(cep).length !== 8 || consultaCep.isPending}
                >
                  {consultaCep.isPending ? "Buscando..." : "Buscar CEP"}
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-[2fr_1fr] gap-2">
              <div>
                <Label>Logradouro</Label>
                <Input
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                />
              </div>
              <div>
                <Label>Número</Label>
                <Input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <Label>Complemento</Label>
                <Input
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-[2fr_1fr] gap-2">
              <div>
                <Label>Cidade</Label>
                <Input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                />
              </div>
              <div>
                <Label>UF</Label>
                <Input
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
                  maxLength={2}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              salvar.mutate({
                responsavel,
                email,
                whatsapp: telefoneParaArmazenar(numeroTel, codigoPais),
                documento: soDigitos(documento) || undefined,
                razaoSocial: razaoSocial || undefined,
                nomeFantasia: nomeFantasia || undefined,
                cep: soDigitos(cep) || undefined,
                logradouro: logradouro || undefined,
                numero: numero || undefined,
                complemento: complemento || undefined,
                bairro: bairro || undefined,
                cidade: cidade || undefined,
                uf: uf || undefined,
              })
            }
            disabled={!podeSalvar || salvar.isPending}
          >
            {salvar.isPending ? "Salvando..." : "Salvar e continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
