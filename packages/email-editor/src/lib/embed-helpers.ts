/**
 * Helpers puros (sem React/UI) usados tanto pelos NodeViews do editor quanto
 * pelo renderer server-side (renderer.tsx).
 */

/** Extrai o ID do vídeo de uma URL do YouTube. */
export function youtubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m?.[1] ?? null;
}

/** Redes suportadas -> slug de ícone (icons8, PNG estável p/ e-mail). */
export const SOCIAL_PLATFORMS: Record<string, { label: string; slug: string }> =
  {
    instagram: { label: "Instagram", slug: "instagram-new" },
    facebook: { label: "Facebook", slug: "facebook-new" },
    x: { label: "X (Twitter)", slug: "twitterx" },
    linkedin: { label: "LinkedIn", slug: "linkedin" },
    youtube: { label: "YouTube", slug: "youtube-play" },
    tiktok: { label: "TikTok", slug: "tiktok" },
    whatsapp: { label: "WhatsApp", slug: "whatsapp" },
    telegram: { label: "Telegram", slug: "telegram-app" },
    github: { label: "GitHub", slug: "github" },
  };

export function socialIconUrl(platform: string, size = 64): string {
  const slug = SOCIAL_PLATFORMS[platform]?.slug ?? "link";
  return `https://img.icons8.com/color/${size}/${slug}.png`;
}

/** URL de imagem do gráfico via QuickChart (renderiza no e-mail como <img>). */
export function quickChartUrl(attrs: {
  chartType?: string;
  title?: string;
  labels?: string;
  values?: string;
  color?: string;
}): string {
  const labels = (attrs.labels ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const data = (attrs.values ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n));
  const config = {
    type: attrs.chartType ?? "bar",
    data: {
      labels,
      datasets: [
        {
          label: attrs.title ?? "",
          data,
          backgroundColor: attrs.color ?? "#2563eb",
          borderColor: attrs.color ?? "#2563eb",
        },
      ],
    },
    options: {
      title: { display: !!attrs.title, text: attrs.title ?? "" },
      legend: { display: false },
    },
  };
  return `https://quickchart.io/chart?w=520&h=300&c=${encodeURIComponent(
    JSON.stringify(config),
  )}`;
}
