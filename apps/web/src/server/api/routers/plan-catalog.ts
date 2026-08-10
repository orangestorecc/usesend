import { z } from "zod";
import {
  createTRPCRouter,
  adminProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  TRANSACTIONAL_PLANS,
  MARKETING_PLANS,
  type CatalogPlan,
} from "~/lib/constants/plan-catalog";

const featureSchema = z.object({ label: z.string(), ok: z.boolean() });

// Semeia o catálogo no banco a partir dos defaults do código (uma vez).
async function ensureSeeded() {
  const count = await db.planCatalogEntry.count();
  if (count > 0) return;

  const seed = async (product: string, plans: CatalogPlan[]) => {
    for (const [i, p] of plans.entries()) {
      await db.planCatalogEntry.create({
        data: {
          product,
          key: p.key,
          name: p.name,
          priceBRL: p.priceBRL,
          volume: p.volume,
          extra: p.extra ?? null,
          features: p.features,
          cta: p.cta,
          highlight: p.highlight ?? false,
          sortOrder: i,
        },
      });
    }
  };
  await seed("transactional", TRANSACTIONAL_PLANS);
  await seed("marketing", MARKETING_PLANS);
}

export const planCatalogRouter = createTRPCRouter({
  // Catálogo público (modal de upgrade / página de planos).
  list: protectedProcedure.query(async () => {
    await ensureSeeded();
    const rows = await db.planCatalogEntry.findMany({
      where: { active: true },
      orderBy: [{ product: "asc" }, { sortOrder: "asc" }],
    });
    const map = (product: string) =>
      rows
        .filter((r) => r.product === product)
        .map((r) => ({
          key: r.key,
          name: r.name,
          priceBRL: r.priceBRL,
          volume: r.volume,
          extra: r.extra ?? undefined,
          features: (r.features as { label: string; ok: boolean }[]) ?? [],
          cta: r.cta,
          highlight: r.highlight,
        }));
    return { transactional: map("transactional"), marketing: map("marketing") };
  }),

  // Admin: lista completa (inclui inativos).
  adminList: adminProcedure.query(async () => {
    await ensureSeeded();
    return db.planCatalogEntry.findMany({
      orderBy: [{ product: "asc" }, { sortOrder: "asc" }],
    });
  }),

  upsert: adminProcedure
    .input(
      z.object({
        id: z.string().optional(),
        product: z.enum(["transactional", "marketing"]),
        key: z.string().min(1).max(40),
        name: z.string().min(1).max(80),
        priceBRL: z.number().int().min(0).nullable(),
        volume: z.string().min(1).max(120),
        extra: z.string().max(160).nullable(),
        features: z.array(featureSchema).max(20),
        highlight: z.boolean(),
        sortOrder: z.number().int(),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const data = {
        product: input.product,
        key: input.key,
        name: input.name,
        priceBRL: input.priceBRL,
        volume: input.volume,
        extra: input.extra,
        features: input.features,
        highlight: input.highlight,
        sortOrder: input.sortOrder,
        active: input.active,
      };
      if (input.id) {
        return db.planCatalogEntry.update({ where: { id: input.id }, data });
      }
      return db.planCatalogEntry.upsert({
        where: { product_key: { product: input.product, key: input.key } },
        create: data,
        update: data,
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.planCatalogEntry.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
