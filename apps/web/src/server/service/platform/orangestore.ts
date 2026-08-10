import type { ContactInput } from "../contact-service";

/**
 * Adapter da plataforma OrangeStore (baseada em OpenCart).
 * Auth: header `X-Oc-Merchant-Id: <apiKey>`.
 * Clientes com paginação por janela de data_modified.
 */

export type SubscribeMode = "newsletter" | "all" | "none";

type OrangeCustomer = Record<string, unknown>;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Formato de data do OpenCart: "YYYY-MM-DD HH:MM:SS" (UTC).
function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate(),
  )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

async function request(
  baseUrl: string,
  apiKey: string,
  path: string,
): Promise<unknown> {
  const url = baseUrl.replace(/\/$/, "") + path;
  const res = await fetch(url, {
    headers: {
      "X-Oc-Merchant-Id": apiKey,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OrangeStore respondeu ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }
  return res.json();
}

// A resposta pode vir como array direto ou embrulhada em {data|customers|result}.
function extractArray(json: unknown): OrangeCustomer[] {
  if (Array.isArray(json)) return json as OrangeCustomer[];
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    for (const k of ["data", "customers", "result", "rows"]) {
      if (Array.isArray(obj[k])) return obj[k] as OrangeCustomer[];
    }
  }
  return [];
}

export async function fetchCustomersPage(opts: {
  baseUrl: string;
  apiKey: string;
  limit: number;
  page: number;
  modifiedAfter?: Date;
}): Promise<OrangeCustomer[]> {
  const a = opts.modifiedAfter ?? new Date("2000-01-01T00:00:00Z");
  const b = new Date();
  const seg = (v: string) => encodeURIComponent(fmtDate(new Date(v)));
  const path =
    `/customers/limit/${opts.limit}/page/${opts.page}` +
    `/date_modified_a/${encodeURIComponent(fmtDate(a))}` +
    `/date_modified_b/${encodeURIComponent(fmtDate(b))}`;
  // (seg não usado diretamente; datas já formatadas acima)
  void seg;
  const json = await request(opts.baseUrl, opts.apiKey, path);
  return extractArray(json);
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

export function mapCustomer(
  c: OrangeCustomer,
  subscribeMode: SubscribeMode,
): ContactInput | null {
  const email = str(c.email)?.toLowerCase();
  if (!email || !email.includes("@")) return null;

  const properties: Record<string, string> = {};
  const telephone = str(c.telephone);
  const document = str(c.document);
  const city = str(c.city);
  const customerId = str(c.customer_id);
  if (telephone) properties.telephone = telephone;
  if (document) properties.document = document;
  if (city) properties.city = city;
  if (customerId) properties.customer_id = customerId;

  const subscribed =
    subscribeMode === "all"
      ? true
      : subscribeMode === "none"
        ? false
        : str(c.newsletter) === "1";

  return {
    email,
    firstName: str(c.firstname),
    lastName: str(c.lastname),
    properties,
    subscribed,
  };
}

export async function testConnection(opts: {
  baseUrl: string;
  apiKey: string;
}): Promise<{
  ok: boolean;
  sampleCount: number;
  sample: { email?: string; firstname?: string; lastname?: string }[];
}> {
  const customers = await fetchCustomersPage({
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    limit: 3,
    page: 1,
  });
  return {
    ok: true,
    sampleCount: customers.length,
    sample: customers.slice(0, 3).map((c) => ({
      email: str(c.email),
      firstname: str(c.firstname),
      lastname: str(c.lastname),
    })),
  };
}
