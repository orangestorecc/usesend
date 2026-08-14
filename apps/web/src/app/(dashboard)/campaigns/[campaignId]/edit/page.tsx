"use client";

import { api } from "~/trpc/react";
import { Spinner } from "@usesend/ui/src/spinner";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Editor } from "@usesend/email-editor";
import type { TiptapEditor } from "@usesend/email-editor";
import { EmailHeaderBar } from "~/components/editor/EmailHeaderBar";
import {
  AlertTriangle,
  Check,
  LayoutTemplate,
  Loader2,
  Pencil,
  Save,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { use, useEffect, useRef, useMemo, useState } from "react";
import { Campaign } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@usesend/ui/src/select";
import { toast } from "@usesend/ui/src/toaster";
import { useDebouncedCallback } from "use-debounce";
import { formatDistanceToNow } from "date-fns";
import ScheduleCampaign from "../../schedule-campaign";
import { useRouter } from "next/navigation";
import { getCampaignEditorVariables } from "~/lib/constants/campaign";
import TemplateSheet, { type TemplateAplicavel } from "~/components/editor/TemplateSheet";
import { useAiRequest } from "~/components/editor/EditorAiBridge";

const IMAGE_SIZE_LIMIT = 10 * 1024 * 1024;

export default function EditCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);

  const {
    data: campaign,
    isLoading,
    error,
  } = api.campaign.getCampaign.useQuery(
    { campaignId },
    {
      enabled: !!campaignId,
    },
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-red-500">Falha ao carregar a campanha</p>
      </div>
    );
  }

  if (!campaign) {
    return <div>Campanha não encontrada</div>;
  }

  return <CampaignEditor campaign={campaign} />;
}

function CampaignEditor({
  campaign,
}: {
  campaign: Campaign & { imageUploadSupported: boolean };
}) {
  const router = useRouter();
  const isApiCampaign = campaign.isApi;
  const contactBooksQuery = api.contacts.getContactBooks.useQuery({});
  const utils = api.useUtils();

  const [json, setJson] = useState<Record<string, any> | undefined>(
    campaign.content ? JSON.parse(campaign.content) : undefined,
  );
  /**
   * Estado do autosave.
   *
   * Um contador — e não um booleano — porque vários saves correm em paralelo
   * (corpo com debounce, blur de campo, dispensa da oferta). Com booleano, o
   * request curto terminava primeiro e a tela dizia "salvo" com o texto do
   * corpo ainda em voo.
   */
  const [pendentes, setPendentes] = useState(0);
  const [falhouSalvar, setFalhouSalvar] = useState(false);
  /**
   * Digitou mas o debounce ainda não disparou o save. Corpo e cabeçalho têm
   * flags separadas: cada um é limpo pelo seu próprio save, senão o save de um
   * campo apagaria o "pendente" do outro e a badge voltaria a mentir.
   */
  const [sujoCorpo, setSujoCorpo] = useState(false);
  const [sujoCabecalho, setSujoCabecalho] = useState(false);
  const isSaving = pendentes > 0 || sujoCorpo || sujoCabecalho;
  const aiRequest = useAiRequest();
  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(
    null,
  );
  const [name, setName] = useState(campaign.name);
  const [subject, setSubject] = useState(campaign.subject);
  const [from, setFrom] = useState(campaign.from);
  const dominiosQuery = api.domain.domains.useQuery();
  const dominiosVerificados = (dominiosQuery.data ?? [])
    .filter((d) => d.status === "SUCCESS")
    .map((d) => d.name);
  const [contactBookId, setContactBookId] = useState(campaign.contactBookId);
  const [replyTo, setReplyTo] = useState<string | undefined>(
    campaign.replyTo[0],
  );
  const [previewText, setPreviewText] = useState<string | null>(
    campaign.previewText,
  );

  // ---- Jornada de templates ----
  const [templateSheetAberto, setTemplateSheetAberto] = useState(false);
  const [ofertaDispensada, setOfertaDispensada] = useState(
    Boolean(campaign.templateOfferDismissedAt),
  );
  /** Snapshot para o "Desfazer" da barra pós-aplicação (conteúdo + assunto). */
  const [desfazer, setDesfazer] = useState<{
    json: Record<string, any> | undefined;
    subject: string;
    assuntoTrocado: boolean;
  } | null>(null);
  /** O setContent da aplicação dispara onUpdate; este ref evita que esse
      mesmo update esconda a barra de Desfazer recém-criada. */
  const ignorarProximoUpdateRef = useRef(false);

  const criarTemplateMutation = api.template.createTemplate.useMutation();

  /** Dispensa a oferta uma vez só, junto do fluxo normal de save. */
  function dispensarOferta() {
    if (ofertaDispensada || isApiCampaign) return;
    setOfertaDispensada(true);
    saveCampaignField({ dismissTemplateOffer: true }, () =>
      setOfertaDispensada(false),
    );
  }

  function aplicarTemplate(t: TemplateAplicavel) {
    if (!editorInstance) return;
    // Trocar de template de novo não pode sobrescrever o snapshot: o "Desfazer"
    // precisa voltar para o que o lojista escreveu, não para o template
    // anterior.
    setDesfazer((anterior) =>
      anterior
        ? { ...anterior, assuntoTrocado: anterior.assuntoTrocado || t.subject !== null }
        : { json, subject, assuntoTrocado: t.subject !== null },
    );
    ignorarProximoUpdateRef.current = true;
    editorInstance.commands.setContent(t.content as never, true);
    if (t.subject !== null) {
      setSubject(t.subject);
      saveCampaignField({ subject: t.subject }, () =>
        setSubject(campaign.subject),
      );
    }
    dispensarOferta();
  }

  function desfazerAplicacao() {
    if (!desfazer || !editorInstance) return;
    ignorarProximoUpdateRef.current = true;
    editorInstance.commands.setContent((desfazer.json ?? "") as never, true);
    if (desfazer.assuntoTrocado) {
      setSubject(desfazer.subject);
      saveCampaignField({ subject: desfazer.subject }, () => undefined);
    }
    setDesfazer(null);
  }

  const updateCampaignMutation = api.campaign.updateCampaign.useMutation({
    onSuccess: () => {
      utils.campaign.getCampaign.invalidate();
    },
  });
  const getUploadUrl = api.campaign.generateImagePresignedUrl.useMutation();

  /**
   * Único caminho de gravação da tela. Mantém o contador de saves em voo e o
   * estado de falha em sincronia — é o que o indicador do topo lê para dizer,
   * em texto, se o trabalho está salvo.
   */
  function saveCampaignField(
    data: Record<string, unknown>,
    revert: () => void,
  ) {
    if (isApiCampaign) return;
    setPendentes((n) => n + 1);
    updateCampaignMutation.mutate(
      { campaignId: campaign.id, ...data } as never,
      {
        onSuccess: () => setFalhouSalvar(false),
        onError: (e) => {
          toast.error(`${e.message}. Revertendo alterações.`);
          setFalhouSalvar(true);
          revert();
        },
        onSettled: () => setPendentes((n) => Math.max(0, n - 1)),
      },
    );
  }

  const marcarCabecalhoSujo = () => setSujoCabecalho(true);

  function updateEditorContent() {
    if (isApiCampaign) {
      return;
    }
    setSujoCorpo(false);
    saveCampaignField({ content: JSON.stringify(json) }, () => undefined);
  }

  const deboucedUpdateCampaign = useDebouncedCallback(
    updateEditorContent,
    1000,
  );

  // Sair da página com o debounce ainda pendente perderia o último trecho
  // digitado — e o indicador estaria dizendo "salvando".
  useEffect(() => {
    const aoSair = () => deboucedUpdateCampaign.flush();
    window.addEventListener("beforeunload", aoSair);
    return () => {
      window.removeEventListener("beforeunload", aoSair);
      deboucedUpdateCampaign.flush();
    };
  }, [deboucedUpdateCampaign]);

  const handleFileChange = async (file: File) => {
    if (file.size > IMAGE_SIZE_LIMIT) {
      throw new Error(
        `O arquivo deve ter menos de ${IMAGE_SIZE_LIMIT / 1024 / 1024}MB`,
      );
    }

    const { uploadUrl, imageUrl } = await getUploadUrl.mutateAsync({
      name: file.name,
      type: file.type,
      campaignId: campaign.id,
    });

    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
    });

    if (!response.ok) {
      throw new Error("Falha ao enviar o arquivo");
    }

    return imageUrl;
  };

  const contactBook = contactBooksQuery.data?.find(
    (book) => book.id === contactBookId,
  );
  const editorVariables = useMemo(
    () => getCampaignEditorVariables(contactBook?.variables),
    [contactBook],
  );
  const variableSuggestionsHelperText = contactBookId
    ? undefined
    : "Selecione a lista de contatos para as variáveis relacionadas";

  return (
    <div className="p-4 container mx-auto ">
      <div className="mx-auto">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            {/* O label ganha o mesmo padding horizontal do input para que o
                texto do título e o rótulo compartilhem a margem esquerda —
                e a caixa de hover do campo não "vaze" para fora dela. */}
            <label
              htmlFor="nome-campanha"
              className="block pl-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Nome da campanha
            </label>
            {/* Affordance de edição: o campo parece um título, mas ganha fundo
                no hover/foco e mostra o lápis — deixando claro que dá para
                clicar e escrever. */}
            {/* `inline-flex` + `field-sizing:content` fazem a caixa acompanhar
                o texto, para o lápis ficar colado no nome em vez de flutuar no
                fim de uma caixa fixa de 420px. */}
            <div className="group relative mt-0.5 flex w-fit max-w-full items-center">
              <Input
                id="nome-campanha"
                type="text"
                value={name}
                placeholder="Dê um nome para esta campanha"
                onChange={(e) => setName(e.target.value)}
                className="h-10 w-full min-w-[140px] max-w-[420px] rounded-md border border-transparent bg-transparent px-2 pr-9 text-xl font-semibold shadow-none transition-colors [field-sizing:content] hover:border-border hover:bg-muted/50 focus:border-border focus-visible:ring-0"
                disabled={isApiCampaign}
                readOnly={isApiCampaign}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                onBlur={() => {
                  if (isApiCampaign || name === campaign.name) {
                    return;
                  }
                  // Nome vazio não é salvo; devolver o valor antigo à tela
                  // evita o campo em branco que finge estar confirmado.
                  if (!name.trim()) {
                    setName(campaign.name);
                    toast.error("A campanha precisa de um nome.");
                    return;
                  }
                  saveCampaignField({ name }, () => setName(campaign.name));
                }}
              />
              {!isApiCampaign ? (
                <Pencil className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground opacity-40 transition-opacity group-hover:opacity-100" />
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <StatusSalvamento
              salvando={isSaving}
              falhou={falhouSalvar}
              atualizadoEm={campaign.updatedAt}
            />

            <ScheduleCampaign
              campaign={campaign}
              onScheduled={() => {
                router.push(`/campaigns/${campaign.id}`);
              }}
            />
          </div>
        </div>


        {isApiCampaign ? (
          <p className="text-sm text-center text-muted-foreground">
            E-mail criado a partir da API. O conteúdo da campanha só pode ser
            atualizado via API.
          </p>
        ) : (
          <div className="rounded-lg border bg-gray-50">
            {desfazer ? (
              <div className="flex items-center justify-between gap-3 border-b bg-muted/60 px-4 py-2 text-sm">
                <span>
                  Template aplicado.
                  {desfazer.assuntoTrocado ? " Assunto atualizado." : ""}
                </span>
                <button
                  type="button"
                  onClick={desfazerAplicacao}
                  className="font-medium underline hover:no-underline"
                >
                  Desfazer
                </button>
              </div>
            ) : null}
            <Editor
              key={`campaign-editor-${contactBookId ?? "none"}-${editorVariables.join(",")}`}
              showBlockPalette
              showPropertiesPanel
              header={
                <EmailHeaderBar
                  rightSlot={
                    !isApiCampaign ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!json || criarTemplateMutation.isPending}
                          onClick={() =>
                            criarTemplateMutation.mutate(
                              {
                                name,
                                subject,
                                content: JSON.stringify(json),
                              },
                              {
                                onSuccess: () =>
                                  toast.success(
                                    "Template salvo. Ele já aparece em Templates.",
                                  ),
                                onError: (e) => toast.error(e.message),
                              },
                            )
                          }
                        >
                          <Save className="mr-1.5 h-3.5 w-3.5" />
                          Salvar como template
                        </Button>
                      </>
                    ) : undefined
                  }
                  toSlot={
                    contactBooksQuery.isLoading ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Select
                        value={contactBookId ?? ""}
                        disabled={isApiCampaign}
                        onValueChange={(val) => {
                          if (isApiCampaign) {
                            return;
                          }
                          setContactBookId(val);
                          saveCampaignField({ contactBookId: val }, () =>
                            setContactBookId(campaign.contactBookId),
                          );
                        }}
                      >
                        <SelectTrigger className="h-8 border-0 bg-transparent px-0 text-sm text-black shadow-none focus:ring-0">
                          <span className="truncate">
                            {contactBook
                              ? `${contactBook.emoji} ${contactBook.name}`
                              : "Selecione uma lista de contatos"}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {contactBooksQuery.data?.map((book) => (
                            <SelectItem key={book.id} value={book.id}>
                              {book.emoji} {book.name}{" "}
                              <span className="ml-4 text-xs text-muted-foreground">
                                {book._count.contacts} contatos
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )
                  }
                  from={{
                    value: from,
                    onDirty: marcarCabecalhoSujo,
                    onChange: (v) => {
                      setFrom(v);
                      setSujoCabecalho(false);
                      saveCampaignField({ from: v }, () => setFrom(campaign.from));
                    },
                  }}
                  replyTo={{
                    value: replyTo ?? "",
                    onDirty: marcarCabecalhoSujo,
                    onChange: (v) => {
                      setReplyTo(v);
                      setSujoCabecalho(false);
                      saveCampaignField({ replyTo: v ? [v] : [] }, () =>
                        setReplyTo(campaign.replyTo[0]),
                      );
                    },
                  }}
                  subject={{
                    value: subject,
                    onDirty: marcarCabecalhoSujo,
                    onChange: (v) => {
                      setSubject(v);
                      setSujoCabecalho(false);
                      saveCampaignField({ subject: v }, () =>
                        setSubject(campaign.subject),
                      );
                    },
                  }}
                  previewText={{
                    value: previewText ?? "",
                    onDirty: marcarCabecalhoSujo,
                    onChange: (v) => {
                      setPreviewText(v);
                      setSujoCabecalho(false);
                      saveCampaignField({ previewText: v }, () =>
                        setPreviewText(campaign.previewText),
                      );
                    },
                  }}
                />
              }
              initialContent={json}
              onCreate={(ed) => setEditorInstance(ed)}
              railSlot={
                !isApiCampaign ? (
                  <button
                    type="button"
                    title="Templates"
                    aria-label="Escolher ou trocar de template"
                    onClick={() => setTemplateSheetAberto(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <LayoutTemplate className="h-4 w-4" />
                  </button>
                ) : undefined
              }
              emptyStateSlot={
                !ofertaDispensada ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTemplateSheetAberto(true)}
                    >
                      <LayoutTemplate className="mr-1.5 h-4 w-4" />
                      Começar por um template
                    </Button>
                    <Button size="sm" variant="ghost" onClick={dispensarOferta}>
                      Escrever do zero
                    </Button>
                  </div>
                ) : undefined
              }
              onUpdate={(content) => {
                setJson(content.getJSON());
                setSujoCorpo(true);
                deboucedUpdateCampaign();
                if (ignorarProximoUpdateRef.current) {
                  ignorarProximoUpdateRef.current = false;
                } else {
                  // Edição de verdade: a oferta some para sempre e a barra de
                  // Desfazer (se houver) perde a razão de existir.
                  dispensarOferta();
                  if (desfazer) setDesfazer(null);
                }
              }}
              variables={editorVariables}
              variableSuggestionsHelperText={variableSuggestionsHelperText}
              onAiRequest={aiRequest}
              placeholder="Pressione '/' para comandos, ou use a IA para escrever seu e-mail"
              uploadImage={
                campaign.imageUploadSupported ? handleFileChange : undefined
              }
            />
          </div>
        )}

        {!isApiCampaign ? <DicaMcp /> : null}
      </div>

      <TemplateSheet
        open={templateSheetAberto}
        onOpenChange={setTemplateSheetAberto}
        onApply={aplicarTemplate}
      />
    </div>
  );
}

/**
 * Estado do autosave em texto explícito.
 *
 * A dúvida do lojista não é "que cor é a bolinha", é "isso está salvo?" — então
 * a resposta vem escrita: "Salvando…" ou "Salvo automaticamente há X". O tempo
 * é recalculado a cada 30s para o rótulo não congelar em "agora mesmo".
 */
function StatusSalvamento({
  salvando,
  falhou,
  atualizadoEm,
}: {
  salvando: boolean;
  falhou: boolean;
  atualizadoEm: Date;
}) {
  const [, forcarRender] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forcarRender((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const recente = Date.now() - new Date(atualizadoEm).getTime() < 60_000;

  if (falhou && !salvando) {
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Não foi possível salvar — verifique sua conexão
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
    >
      {salvando ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Salvando…
        </>
      ) : (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600" />
          Salvo automaticamente{" "}
          {recente ? "agora mesmo" : `há ${formatDistanceToNow(atualizadoEm)}`}
        </>
      )}
    </div>
  );
}

/** Lembra que a mesma campanha pode ser montada pelo assistente via MCP. */
function DicaMcp() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 text-sm">
      <div className="flex items-center gap-2.5">
        <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">
          Prefere pedir a campanha conversando? Peça ao ChatGPT ou ao Claude
          para montar esta campanha por você — é só conectar uma vez{" "}
          <span className="text-foreground">(via MCP)</span>.
        </span>
      </div>
      <Link
        href="/dev-settings/mcp"
        className="shrink-0 font-medium underline underline-offset-4 hover:no-underline"
      >
        Conectar meu assistente
      </Link>
    </div>
  );
}
