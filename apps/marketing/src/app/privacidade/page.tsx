import type { Metadata } from "next";
import { TopNav } from "~/components/TopNav";
import { SiteFooter } from "~/components/SiteFooter";

const SITE_URL = "https://www.madmail.com.br";
const CONTATO = "contato@madmail.com.br";

export const metadata: Metadata = {
  title: "Política de Privacidade — Madmail",
  description:
    "Como a Madmail coleta, usa e protege dados pessoais, e quais são os seus direitos pela LGPD.",
  alternates: { canonical: `${SITE_URL}/privacidade` },
};

/**
 * Rascunho para revisão jurídica.
 *
 * O texto descreve o que o produto realmente faz hoje — provedores usados,
 * prazos de retenção e finalidades — em vez de um modelo genérico. Números
 * errados numa política de privacidade são pior que texto vago, porque viram
 * promessa que não se cumpre.
 */
export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">
          Política de Privacidade
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Última atualização: agosto de 2026.
        </p>

        <Bloco titulo="Quem somos">
          <p>
            A Madmail é uma plataforma de envio de e-mails transacionais e de
            marketing, operada no Brasil. Nesta política, &quot;nós&quot; se
            refere à Madmail e &quot;você&quot; ao titular dos dados — seja
            visitante do site, cliente da plataforma ou destinatário de um
            e-mail enviado por um cliente nosso.
          </p>
        </Bloco>

        <Bloco titulo="Dois papéis diferentes">
          <p>
            Essa distinção muda quem responde pelo quê, então vem antes de tudo:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Dados da sua conta</strong> — nome, e-mail, telefone,
              dados de faturamento. Aqui somos <em>controladores</em>: nós
              decidimos por que e como tratar.
            </li>
            <li>
              <strong>Sua lista de contatos e o conteúdo dos seus e-mails</strong>{" "}
              — aqui somos <em>operadores</em>. Quem decide o que enviar e para
              quem é você; nós processamos conforme a sua instrução. A base
              legal para falar com esses contatos, e o consentimento deles, são
              responsabilidade sua.
            </li>
          </ul>
        </Bloco>

        <Bloco titulo="O que coletamos">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Cadastro</strong>: nome, e-mail e, quando você usa login
              social, o identificador do provedor.
            </li>
            <li>
              <strong>Faturamento</strong>: responsável financeiro, e-mail,
              WhatsApp e, quando informados, CPF ou CNPJ, razão social e
              endereço — necessários para emitir nota fiscal.
            </li>
            <li>
              <strong>Pagamento</strong>: os dados do cartão são enviados
              diretamente ao provedor de pagamento e{" "}
              <strong>não são guardados por nós</strong>. Guardamos apenas
              bandeira, últimos quatro dígitos e um identificador de cobrança.
            </li>
            <li>
              <strong>Uso da plataforma</strong>: registros de envio, entrega,
              abertura, clique, retorno e reclamação, além de logs técnicos de
              requisição à API.
            </li>
            <li>
              <strong>Contatos que você importa</strong>: os campos que você
              enviar, mais o arquivo original da importação.
            </li>
          </ul>
        </Bloco>

        <Bloco titulo="Por quanto tempo guardamos">
          <ul className="list-disc space-y-2 pl-5">
            <li>Registros de e-mail e eventos: 30 dias.</li>
            <li>
              Arquivos de importação de contatos: 90 dias, e depois são
              apagados.
            </li>
            <li>
              Dados de cadastro e faturamento: enquanto a conta existir e pelo
              prazo que a legislação fiscal exigir depois disso.
            </li>
            <li>
              Contatos das suas listas: enquanto você mantiver, ou até você
              apagar.
            </li>
          </ul>
        </Bloco>

        <Bloco titulo="Com quem compartilhamos">
          <p>
            Não vendemos dados. Compartilhamos apenas com quem é necessário
            para o serviço funcionar:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Amazon Web Services</strong> — infraestrutura de envio
              (Amazon SES) e armazenamento.
            </li>
            <li>
              <strong>Provedores de pagamento</strong> — para processar
              cobranças por cartão, PIX e boleto.
            </li>
            <li>
              <strong>Autoridades</strong> — quando houver obrigação legal.
            </li>
          </ul>
        </Bloco>

        <Bloco titulo="Seus direitos (LGPD)">
          <p>
            Você pode pedir confirmação de tratamento, acesso, correção,
            anonimização, portabilidade ou exclusão dos seus dados, além de
            revogar consentimento. Escreva para{" "}
            <a href={`mailto:${CONTATO}`} className="underline">
              {CONTATO}
            </a>{" "}
            e respondemos em até 15 dias.
          </p>
          <p className="mt-3">
            Se você recebeu um e-mail enviado por um cliente nosso e quer sair
            da lista, use o link de descadastro na própria mensagem — é o
            caminho mais rápido. Se preferir, fale conosco e encaminhamos ao
            responsável.
          </p>
        </Bloco>

        <Bloco titulo="Cookies">
          <p>
            No site usamos apenas o necessário para lembrar sua preferência de
            tema. Na plataforma, cookies de sessão mantêm você autenticado. Não
            usamos cookies de publicidade.
          </p>
        </Bloco>

        <Bloco titulo="Alterações">
          <p>
            Se mudarmos esta política de forma relevante, avisamos por e-mail
            aos clientes ativos antes de a mudança valer.
          </p>
        </Bloco>

        <p className="mt-10 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Rascunho.</strong> Este texto
          descreve o funcionamento real da plataforma, mas ainda não passou por
          revisão jurídica. Antes do lançamento comercial, precisa ser revisado
          por advogado e complementado com a razão social e o CNPJ da operadora.
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
