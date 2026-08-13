import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE_URL = "https://www.madmail.com.br";

const FEATURE_SLUGS = [
  "email-api",
  "smtp",
  "editor",
  "templates",
  "automacoes",
  "contatos",
  "webhooks",
  "entregabilidade",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/ai",
    "/pricing",
    "/sobre",
    "/legal/termos-de-uso",
    "/legal/politica-de-privacidade",
    "/legal/politica-de-uso-aceitavel",
    "/legal/dpa",
    "/legal/suboperadores",
    ...FEATURE_SLUGS.map((slug) => `/features/${slug}`),
  ];
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
