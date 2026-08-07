import { Prisma } from "@prisma/client";
import { db } from "../db";

// ---- Formato das regras (armazenado em Segment.rules) ----
// {
//   "match": "all" | "any",              // AND (default) ou OR
//   "conditions": [
//     { "field": "properties.cidade", "op": "eq", "value": "São Paulo" },
//     { "field": "subscribed", "op": "eq", "value": true },
//     { "field": "email", "op": "contains", "value": "@gmail.com" }
//   ]
// }
// Campos: email | firstName | lastName | subscribed | properties.<chave>
// Ops: eq | neq | contains | in

export type SegmentCondition = {
  field: string;
  op: "eq" | "neq" | "contains" | "in";
  value?: unknown;
};
export type SegmentRules = {
  match?: "all" | "any";
  conditions: SegmentCondition[];
};

const SCALAR_FIELDS = ["email", "firstName", "lastName", "subscribed"] as const;

function conditionToWhere(cond: SegmentCondition): Prisma.ContactWhereInput {
  const { field, op, value } = cond;

  if (field.startsWith("properties.")) {
    const key = field.slice("properties.".length);
    switch (op) {
      case "eq":
        return { properties: { path: [key], equals: value as any } };
      case "neq":
        return { NOT: { properties: { path: [key], equals: value as any } } };
      case "contains":
        return { properties: { path: [key], string_contains: String(value) } };
      case "in":
        return {
          OR: (Array.isArray(value) ? value : [value]).map((v) => ({
            properties: { path: [key], equals: v as any },
          })),
        };
      default:
        throw new Error(`Operador inválido para propriedade: ${op}`);
    }
  }

  if (!SCALAR_FIELDS.includes(field as (typeof SCALAR_FIELDS)[number])) {
    throw new Error(`Campo inválido: ${field}`);
  }

  switch (op) {
    case "eq":
      return { [field]: value } as Prisma.ContactWhereInput;
    case "neq":
      return { NOT: { [field]: value } } as Prisma.ContactWhereInput;
    case "contains":
      return {
        [field]: { contains: String(value), mode: "insensitive" },
      } as Prisma.ContactWhereInput;
    case "in":
      return {
        [field]: { in: Array.isArray(value) ? value : [value] },
      } as Prisma.ContactWhereInput;
    default:
      throw new Error(`Operador inválido: ${op}`);
  }
}

export function buildContactWhere(
  rules: SegmentRules,
  teamId: number,
  contactBookId?: string | null,
): Prisma.ContactWhereInput {
  const base: Prisma.ContactWhereInput = contactBookId
    ? { contactBookId }
    : { contactBook: { teamId } };

  const conds = (rules?.conditions ?? []).map(conditionToWhere);
  if (conds.length === 0) return base;

  const combiner: Prisma.ContactWhereInput =
    rules.match === "any" ? { OR: conds } : { AND: conds };

  return { AND: [base, combiner] };
}

export async function previewSegment(
  teamId: number,
  contactBookId: string | null,
  rules: SegmentRules,
  sampleSize = 5,
) {
  const where = buildContactWhere(rules, teamId, contactBookId);
  const [count, sample] = await Promise.all([
    db.contact.count({ where }),
    db.contact.findMany({
      where,
      select: { email: true, firstName: true, lastName: true, subscribed: true },
      take: sampleSize,
    }),
  ]);
  return { count, sample };
}

// Materializa um segmento numa NOVA lista (contact book), copiando os contatos que casam.
export async function materializeSegment(
  teamId: number,
  contactBookId: string | null,
  rules: SegmentRules,
  newListName: string,
) {
  const where = buildContactWhere(rules, teamId, contactBookId);
  const contacts = await db.contact.findMany({
    where,
    select: {
      email: true,
      firstName: true,
      lastName: true,
      properties: true,
      subscribed: true,
    },
  });

  const book = await db.contactBook.create({
    data: { name: newListName, teamId, properties: {} },
  });

  if (contacts.length > 0) {
    await db.contact.createMany({
      data: contacts.map((c) => ({
        contactBookId: book.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        properties: c.properties as Prisma.InputJsonValue,
        subscribed: c.subscribed,
      })),
      skipDuplicates: true,
    });
  }

  return { listId: book.id, name: book.name, count: contacts.length };
}
