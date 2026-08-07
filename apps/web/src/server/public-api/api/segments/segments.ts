import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { UnsendApiError } from "~/server/public-api/api-error";
import { db } from "~/server/db";
import {
  previewSegment,
  materializeSegment,
  type SegmentRules,
} from "~/server/service/segment-service";

const rulesSchema = z.object({
  match: z.enum(["all", "any"]).optional(),
  conditions: z.array(
    z.object({
      field: z.string(),
      op: z.enum(["eq", "neq", "contains", "in"]),
      value: z.any().optional(),
    }),
  ),
});

const segmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  contactBookId: z.string().nullable(),
  rules: z.any(),
  createdAt: z.string(),
});

async function requireSegment(teamId: number, segmentId: string) {
  const seg = await db.segment.findFirst({ where: { id: segmentId, teamId } });
  if (!seg) {
    throw new UnsendApiError({ code: "NOT_FOUND", message: "Segment not found" });
  }
  return seg;
}

export default function registerSegments(app: PublicAPIApp) {
  // ---- create ----
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/segments",
      request: {
        body: {
          content: {
            "application/json": {
              schema: z.object({
                name: z.string().min(1),
                contactBookId: z.string().optional(),
                rules: rulesSchema,
              }),
            },
          },
        },
      },
      responses: {
        200: {
          content: { "application/json": { schema: segmentSchema } },
          description: "Create a segment",
        },
      },
    }),
    async (c) => {
      const team = c.var.team;
      const body = c.req.valid("json");
      if (body.contactBookId) {
        const book = await db.contactBook.findFirst({
          where: { id: body.contactBookId, teamId: team.id },
          select: { id: true },
        });
        if (!book) {
          throw new UnsendApiError({
            code: "BAD_REQUEST",
            message: "contactBookId inválido para este time",
          });
        }
      }
      const seg = await db.segment.create({
        data: {
          teamId: team.id,
          name: body.name,
          contactBookId: body.contactBookId ?? null,
          rules: body.rules,
        },
      });
      return c.json({
        id: seg.id,
        name: seg.name,
        contactBookId: seg.contactBookId,
        rules: seg.rules,
        createdAt: seg.createdAt.toISOString(),
      });
    },
  );

  // ---- list ----
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/segments",
      responses: {
        200: {
          content: { "application/json": { schema: z.array(segmentSchema) } },
          description: "List segments",
        },
      },
    }),
    async (c) => {
      const team = c.var.team;
      const segs = await db.segment.findMany({
        where: { teamId: team.id },
        orderBy: { createdAt: "desc" },
      });
      return c.json(
        segs.map((s) => ({
          id: s.id,
          name: s.name,
          contactBookId: s.contactBookId,
          rules: s.rules,
          createdAt: s.createdAt.toISOString(),
        })),
      );
    },
  );

  // ---- preview (count + sample) ----
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/segments/{segmentId}/preview",
      request: { params: z.object({ segmentId: z.string() }) },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({ count: z.number(), sample: z.array(z.any()) }),
            },
          },
          description: "Preview matching contacts (count + sample)",
        },
      },
    }),
    async (c) => {
      const team = c.var.team;
      const { segmentId } = c.req.valid("param");
      const seg = await requireSegment(team.id, segmentId);
      const result = await previewSegment(
        team.id,
        seg.contactBookId,
        seg.rules as unknown as SegmentRules,
      );
      return c.json(result);
    },
  );

  // ---- materialize (cria nova lista com os contatos que casam) ----
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/segments/{segmentId}/materialize",
      request: {
        params: z.object({ segmentId: z.string() }),
        body: {
          content: {
            "application/json": {
              schema: z.object({ name: z.string().min(1) }),
            },
          },
        },
      },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                listId: z.string(),
                name: z.string(),
                count: z.number(),
              }),
            },
          },
          description: "Materialize segment into a new contact book",
        },
      },
    }),
    async (c) => {
      const team = c.var.team;
      const { segmentId } = c.req.valid("param");
      const { name } = c.req.valid("json");
      const seg = await requireSegment(team.id, segmentId);
      const result = await materializeSegment(
        team.id,
        seg.contactBookId,
        seg.rules as unknown as SegmentRules,
        name,
      );
      return c.json(result);
    },
  );

  // ---- delete ----
  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/segments/{segmentId}",
      request: { params: z.object({ segmentId: z.string() }) },
      responses: {
        200: {
          content: {
            "application/json": { schema: z.object({ success: z.boolean() }) },
          },
          description: "Delete a segment",
        },
      },
    }),
    async (c) => {
      const team = c.var.team;
      const { segmentId } = c.req.valid("param");
      await requireSegment(team.id, segmentId);
      await db.segment.delete({ where: { id: segmentId } });
      return c.json({ success: true });
    },
  );
}
