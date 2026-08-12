import type { Metadata } from "next";
import { TopNav } from "~/components/TopNav";
import { SiteFooter } from "~/components/SiteFooter";

const SITE_URL = "https://www.madmail.com.br";
const CONTATO = "contato@madmail.com.br";

export const metadata: Metadata = {
  title: "Termos de Uso — Madmail",
  description:
    "Regras de uso da plataforma Madmail: contratação, pagamento, uso aceitável e cancelamento.",
  alternates: { canonical: `${SITE_URL}/termos` },
};

/**
 * Rascunho para revisão jurídica.
 *
 * Escrito a partir do que o produto faz de fato — planos por faixa de volume,
 * cobrança mensal em reais, supressão automática — para não prometer regra
 * que o sistema não aplica.
 */
export default function TermosPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">
          Termos de Uso
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Última atualização: agosto de 2026.
        </p>

        <Bloco titulo="O que você contrata">
          <p>
            A Madmail fornece uma plataforma para enviar e-mails transacionais e
            campanhas de marketing, com editor, gestão de contatos, automações,
            métricas, API, relay SMTP e conector de IA (MCP). A entrega é feita
            pela infraestrutura da Amazon Web Services, via Amazon SES.
          </p>
          <p>
            Ao criar uma conta, você concorda com estes termos. Se estiver
            contratando em nome de uma empresa, declara ter poderes para isso.
          </p>
        </Bloco>

        <Bloco titulo="Planos e pagamento">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Os planos são mensais, em reais, com nota fiscal, e o preço é
              fixo por faixa de volume.
            </li>
            <li>
              O envio acima da faixa contratada é cobrado por mil e-mails
              excedentes, pela tarifa do plano vigente.
            </li>
            <li>
              A renovação é automática a cada mês, no mesmo meio de pagamento,
              até você cancelar.
            </li>
            <li>
              Não há fidelidade nem multa. O cancelamento vale para o próximo
              ciclo; o período já pago não é devolvido proporcionalmente.
            </li>
            <li>
              Se o pagamento falhar, avisamos e a conta pode ser suspensa até a
              regularização. Seus dados continuam disponíveis durante esse
              período.
            </li>
          </ul>
        </Bloco>

        <Bloco titulo="Uso aceitável">
          <p>
            Você é responsável pelo conteúdo que envia e por ter base legal para
            falar com cada destinatário. Não é permitido:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              enviar para listas compradas, alugadas ou coletadas sem
              consentimento;
            </li>
            <li>
              enviar mensagem enganosa, com remetente ou assunto que finja ser
              outra pessoa ou empresa;
            </li>
            <li>
              enviar conteúdo ilegal, fraudulento, de phishing ou que
              distribua programa malicioso;
            </li>
            <li>
              remover, esconder ou quebrar o link de descadastro nas campanhas
              de marketing;
            </li>
            <li>
              contornar limites de volume, do plano ou dos controles da
              plataforma.
            </li>
          </ul>
          <p className="mt-3">
            Endereços que retornam erro permanente ou registram reclamação de
            spam entram automaticamente na lista de supressão e param de
            receber. Isso não é opcional: protege a entregabilidade de todos os
            clientes.
          </p>
        </Bloco>

        <Bloco titulo="Suspensão">
          <p>
            Podemos suspender ou encerrar uma conta que descumpra estes termos,
            que gere taxa de reclamação ou de retorno fora do aceitável, ou que
            coloque em risco a reputação de envio da plataforma. Sempre que for
            possível, avisamos antes e damos chance de corrigir. Em caso de
            risco imediato — fraude ou abuso em curso — a suspensão é imediata.
          </p>
        </Bloco>

        <Bloco titulo="Seus dados e seu conteúdo">
          <p>
            Seus contatos, templates e campanhas são seus. Você pode exportar
            quando quiser e, ao encerrar a conta, pode pedir a exclusão. Nós os
            usamos apenas para operar o serviço que você contratou, conforme a{" "}
            <a href="/privacidade" className="underline">
              Política de Privacidade
            </a>
            .
          </p>
        </Bloco>

        <Bloco titulo="Disponibilidade e limites de responsabilidade">
          <p>
            Trabalhamos para manter a plataforma no ar e publicamos o estado dos
            serviços na página de status. Ainda assim, o serviço depende de
            terceiros — provedores de infraestrutura e caixas de entrada de
            destino — e não garantimos entrega em caixa de entrada, que depende
            de fatores fora do nosso controle, inclusive da reputação do seu
            próprio domínio.
          </p>
        </Bloco>

        <Bloco titulo="Mudanças nos termos">
          <p>
            Podemos ajustar estes termos e os preços. Mudança relevante é
            avisada por e-mail aos clientes ativos com antecedência, e passa a
            valer no ciclo seguinte.
          </p>
        </Bloco>

        <Bloco titulo="Contato">
          <p>
            Dúvidas sobre estes termos:{" "}
            <a href={`mailto:${CONTATO}`} className="underline">
              {CONTATO}
            </a>
            .
          </p>
        </Bloco>

        <p className="mt-10 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Rascunho.</strong> Este texto
          reflete como a plataforma funciona hoje, mas ainda não passou por
          revisão jurídica. Antes do lançamento comercial, precisa ser revisado
          por advogado e completado com razão social, CNPJ e foro.
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}

function Bloco({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">{titulo}</h2>
      <div className="space-y-2 leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
