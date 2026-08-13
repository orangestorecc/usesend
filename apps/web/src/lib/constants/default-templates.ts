/**
 * Modelos básicos de e-mail (inspirados nos templates padrão do Brevo),
 * no formato JSON do @usesend/email-editor.
 *
 * Usados pelo script de seed (src/scripts/seed-default-templates.ts) para
 * criar os modelos na conta do admin e, futuramente, provisionar
 * automaticamente para novos times no onboarding.
 */

type JSONNode = Record<string, unknown>;

const PLACEHOLDER_LOGO = "https://placehold.co/160x48/18181b/ffffff.png?text=Logo";
const PLACEHOLDER_WIDE = "https://placehold.co/600x300/f4f4f5/a1a1aa.png?text=Imagem";
const PLACEHOLDER_SQUARE = "https://placehold.co/280x220/f4f4f5/a1a1aa.png?text=Imagem";
const PLACEHOLDER_PRODUCT = "https://placehold.co/180x150/f4f4f5/a1a1aa.png?text=Produto";

const GRAY = "#71717a";
const UNSUBSCRIBE_URL = "{{usesend_unsubscribe_url}}";

function text(value: string, marks?: JSONNode[]): JSONNode {
  return { type: "text", text: value, ...(marks ? { marks } : {}) };
}

function small(value: string): JSONNode {
  return text(value, [{ type: "textStyle", attrs: { fontSize: "12px", color: GRAY } }]);
}

function paragraph(align: string, content: JSONNode[]): JSONNode {
  return { type: "paragraph", attrs: { textAlign: align }, content };
}

function heading(level: number, align: string, value: string): JSONNode {
  return {
    type: "heading",
    attrs: { level, textAlign: align },
    content: [text(value)],
  };
}

function image(src: string, width: string, alt = "Imagem"): JSONNode {
  return {
    type: "image",
    attrs: {
      src,
      alt,
      width,
      height: "auto",
      alignment: "center",
      borderRadius: "8",
      borderWidth: "0",
      borderColor: "rgb(0, 0, 0)",
      externalLink: null,
    },
  };
}

function button(label: string, alignment = "center"): JSONNode {
  return {
    type: "button",
    attrs: {
      text: label,
      url: "https://",
      alignment,
      borderRadius: "6",
      borderWidth: "1",
      buttonColor: "#18181b",
      borderColor: "#18181b",
      textColor: "#ffffff",
    },
  };
}

function spacer(height: string): JSONNode {
  return { type: "spacer", attrs: { height } };
}

function variable(id: string, fallback: string | null = null): JSONNode {
  return { type: "variable", attrs: { id, name: id, fallback } };
}

const logoBlock = image(PLACEHOLDER_LOGO, "160", "Logo");

/** Rodapé padrão Madmail (endereço + motivo do recebimento + descadastro). */
const footer: JSONNode[] = [
  spacer("md"),
  {
    type: "section",
    attrs: {
      backgroundColor: "#f4f4f5",
      padding: "24px",
      borderRadius: "8px",
      align: "center",
    },
    content: [
      paragraph("center", [text("Sua empresa", [{ type: "bold" }])]),
      paragraph("center", [small("Rua Exemplo, 123 — Porto Alegre/RS")]),
      paragraph("center", [
        small("Este e-mail foi enviado para "),
        variable("email"),
        small(". Você o recebeu porque se inscreveu em nossa newsletter."),
      ]),
      {
        type: "unsubscribeFooter",
        attrs: { component: "unsubscribeFooter" },
        content: [
          text("Cancelar inscrição", [
            {
              type: "link",
              attrs: {
                href: UNSUBSCRIBE_URL,
                target: "_blank",
                rel: "noopener noreferrer nofollow",
              },
            },
          ]),
        ],
      },
      paragraph("center", [small("Enviado com Madmail")]),
    ],
  },
];

const pageStyle = {
  backgroundColor: "#ffffff",
  contentBackground: "#ffffff",
  contentWidth: "600px",
  contentAlign: "center",
};

function doc(content: JSONNode[]): JSONNode {
  return { type: "doc", attrs: { pageStyle }, content };
}

/** 1. Promoção simples: título, imagem destaque, duas imagens, texto e CTA. */
const promoSimples = doc([
  logoBlock,
  spacer("sm"),
  heading(1, "center", "Este é o seu título."),
  spacer("sm"),
  image(PLACEHOLDER_WIDE, "600", "Imagem de destaque"),
  spacer("sm"),
  {
    type: "columns",
    attrs: { gap: "16px" },
    content: [
      {
        type: "column",
        attrs: { width: null },
        content: [image(PLACEHOLDER_SQUARE, "280")],
      },
      {
        type: "column",
        attrs: { width: null },
        content: [image(PLACEHOLDER_SQUARE, "280")],
      },
    ],
  },
  spacer("md"),
  heading(2, "left", "Seu título aqui"),
  paragraph("left", [
    text("Comece sua newsletter com imagens visualmente impressionantes."),
  ]),
  paragraph("left", [
    text(
      "Substitua a imagem de destaque e as imagens principais pelas suas próprias imagens, ou use um fundo de cor sólida.",
    ),
  ]),
  spacer("sm"),
  button("Chamada para ação"),
  ...footer,
]);

/** 2. Vitrine de produtos: hero, três produtos com CTA e cupom de desconto. */
const vitrineProdutos = doc([
  logoBlock,
  spacer("sm"),
  {
    type: "section",
    attrs: {
      backgroundColor: "#f4f4f5",
      padding: "32px",
      borderRadius: "8px",
      align: "center",
    },
    content: [
      heading(1, "center", "O essencial para cada momento"),
      paragraph("center", [
        text(
          "Nossos produtos mais recentes foram pensados para complementar o seu estilo de vida. Explore uma coleção que tem algo a oferecer para todos.",
        ),
      ]),
      spacer("sm"),
      button("Descubra a coleção"),
    ],
  },
  spacer("md"),
  heading(2, "left", "Destaques da coleção"),
  paragraph("left", [
    text(
      "Inspirada no dia a dia, esta coleção combina conforto e estilo — perfeita para aproveitar a estação com energia.",
    ),
  ]),
  spacer("sm"),
  {
    type: "columns",
    attrs: { gap: "16px" },
    content: [1, 2, 3].map(() => ({
      type: "column",
      attrs: { width: null },
      content: [
        image(PLACEHOLDER_PRODUCT, "180", "Produto"),
        heading(3, "left", "Seu produto"),
        paragraph("left", [
          text("Descreva os benefícios do seu produto em uma frase rápida."),
        ]),
        button("Comprar agora", "left"),
      ],
    })),
  },
  spacer("md"),
  {
    type: "section",
    attrs: {
      backgroundColor: "#f4f4f5",
      padding: "32px",
      borderRadius: "8px",
      align: "center",
    },
    content: [
      paragraph("center", [
        text(
          "Não perca a promoção em andamento: use este cupom por tempo limitado em uma seleção de produtos.",
        ),
      ]),
      heading(1, "center", "PROMO15"),
    ],
  },
  ...footer,
]);

/** 3. Novidades e atualizações: saudação personalizada e blocos de novidades. */
const novidades = doc([
  logoBlock,
  spacer("sm"),
  paragraph("left", [
    text("Olá "),
    variable("firstName", "tudo bem"),
    text(
      ", um novo ciclo significa novas oportunidades. Se você está definindo grandes metas ou apenas ajustando a rotina, este é o momento perfeito para se atualizar e tornar os próximos meses os mais produtivos até agora.",
    ),
  ]),
  spacer("sm"),
  heading(2, "left", "Torne-o exclusivamente seu"),
  paragraph("left", [
    text(
      "Todos os dias as pessoas encontram novas maneiras de aproveitar melhor nosso produto. Que tal reservar um momento para ajustar a sua configuração e começar com o pé direito? ",
    ),
    text("Começar agora", [
      {
        type: "link",
        attrs: {
          href: "https://",
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      },
    ]),
  ]),
  image(PLACEHOLDER_WIDE, "600"),
  spacer("md"),
  heading(2, "left", "Fique por dentro das últimas atualizações"),
  paragraph("left", [
    text(
      "Você pediu, nós ouvimos. Lançamos uma série de novos recursos e há uma boa chance de você gostar de vários deles. Dê uma olhada no que há de novo! ",
    ),
    text("Ver as novidades", [
      {
        type: "link",
        attrs: {
          href: "https://",
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      },
    ]),
  ]),
  image(PLACEHOLDER_WIDE, "600"),
  spacer("md"),
  heading(2, "left", "Recursos para ajudar você a começar"),
  paragraph("left", [
    text(
      "Comece bem com nossos modelos e ferramentas mais populares, feitos para manter você produtivo, organizado e no caminho certo. ",
    ),
    text("Explorar agora", [
      {
        type: "link",
        attrs: {
          href: "https://",
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      },
    ]),
  ]),
  spacer("md"),
  paragraph("left", [
    text(
      "Somos muito gratos por ter você conosco e estamos empolgados com o que vem por aí: novos recursos, melhorias e maneiras de tornar sua experiência ainda melhor. Que venham mais crescimento, criatividade e sucesso!",
    ),
  ]),
  ...footer,
]);

export const DEFAULT_TEMPLATES: {
  name: string;
  subject: string;
  content: JSONNode;
}[] = [
  {
    name: "Promoção simples",
    subject: "Uma novidade especial para você",
    content: promoSimples,
  },
  {
    name: "Vitrine de produtos",
    subject: "Conheça a nossa nova coleção",
    content: vitrineProdutos,
  },
  {
    name: "Novidades e atualizações",
    subject: "Veja o que há de novo por aqui",
    content: novidades,
  },
];
