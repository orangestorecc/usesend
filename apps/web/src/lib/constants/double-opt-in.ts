export const DEFAULT_DOUBLE_OPT_IN_SUBJECT = "Confirme sua inscrição";

const DEFAULT_DOUBLE_OPT_IN_CONTENT_JSON = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [
        {
          type: "text",
          text: "Olá! Obrigado por se inscrever. Confirme que você quer receber nossos e-mails.",
        },
      ],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [
        {
          type: "text",
          text: "Se você não fez essa solicitação, é só ignorar este e-mail.",
        },
      ],
    },
    {
      type: "button",
      attrs: {
        component: "button",
        text: "Confirmar inscrição",
        url: "{{doubleOptInUrl}}",
        alignment: "left",
        borderRadius: "8",
        borderWidth: "1",
        buttonColor: "#000000",
        borderColor: "#000000",
        textColor: "#ffffff",
      },
    },
    {
      type: "horizontalRule",
    },
    {
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [
        {
          type: "text",
          text: "Você recebeu este e-mail porque se inscreveu em nosso site.",
        },
      ],
    },
  ],
};

export const DEFAULT_DOUBLE_OPT_IN_CONTENT = JSON.stringify(
  DEFAULT_DOUBLE_OPT_IN_CONTENT_JSON,
);

export const DOUBLE_OPT_IN_EDITOR_VARIABLES = [
  "email",
  "firstName",
  "lastName",
  "doubleOptInUrl",
];

const DOUBLE_OPT_IN_URL_PLACEHOLDER_REGEX =
  /\{\{\s*doubleOptInUrl(?:\s*,\s*fallback=[^}]+)?\s*\}\}/i;

function valueIncludesDoubleOptInUrl(value: unknown): boolean {
  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    return (
      DOUBLE_OPT_IN_URL_PLACEHOLDER_REGEX.test(value) ||
      normalizedValue === "doubleoptinurl"
    );
  }

  if (Array.isArray(value)) {
    return value.some(valueIncludesDoubleOptInUrl);
  }

  if (value && typeof value === "object") {
    return Object.values(value).some(valueIncludesDoubleOptInUrl);
  }

  return false;
}

export function hasDoubleOptInUrlPlaceholder(content: string): boolean {
  if (DOUBLE_OPT_IN_URL_PLACEHOLDER_REGEX.test(content)) {
    return true;
  }

  try {
    return valueIncludesDoubleOptInUrl(JSON.parse(content));
  } catch {
    return false;
  }
}

export function getDefaultDoubleOptInContent() {
  return structuredClone(DEFAULT_DOUBLE_OPT_IN_CONTENT_JSON) as Record<
    string,
    any
  >;
}
