import { z } from "zod";

import {
  createTRPCRouter,
  teamProcedure,
  protectedProcedure,
  domainProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  createDomain,
  deleteDomain,
  getDomain,
  getDomains,
  updateDomain,
} from "~/server/service/domain-service";
import { sendEmail } from "~/server/service/email-service";
import { setDomainReceiving } from "~/server/aws/inbound-ses";
import { SesSettingsService } from "~/server/service/ses-settings-service";
import {
  getValidSesRegions,
  sesRegionSchema,
} from "~/lib/zod/ses-setting-schema";

export const domainRouter = createTRPCRouter({
  getAvailableRegions: protectedProcedure.query(async () => {
    const settings = await SesSettingsService.getAllSettings();
    return getValidSesRegions(settings.map((setting) => setting.region));
  }),

  createDomain: teamProcedure
    .input(z.object({ name: z.string(), region: sesRegionSchema }))
    .mutation(async ({ ctx, input }) => {
      return createDomain(
        ctx.team.id,
        input.name,
        input.region,
        ctx.team.sesTenantId ?? undefined
      );
    }),

  startVerification: domainProcedure.mutation(async ({ ctx, input }) => {
    await ctx.db.domain.update({
      where: { id: input.id },
      data: { isVerifying: true },
    });
  }),

  domains: teamProcedure.query(async ({ ctx }) => {
    return getDomains(ctx.team.id);
  }),

  getDomain: domainProcedure.query(async ({ input, ctx }) => {
    return getDomain(input.id, ctx.team.id);
  }),

  updateDomain: domainProcedure
    .input(
      z.object({
        clickTracking: z.boolean().optional(),
        openTracking: z.boolean().optional(),
        tlsEnforced: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return updateDomain(input.id, {
        clickTracking: input.clickTracking,
        openTracking: input.openTracking,
        tlsEnforced: input.tlsEnforced,
      });
    }),

  setReceiving: domainProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const domain = await db.domain.findFirst({
        where: { id: input.id, teamId: ctx.team.id },
      });
      if (!domain) {
        throw new Error("Domínio não encontrado");
      }
      await setDomainReceiving(domain.id, domain.name, input.enabled);
      await db.domain.update({
        where: { id: domain.id },
        data: { receivingEnabled: input.enabled },
      });
      return { success: true };
    }),

  deleteDomain: domainProcedure.mutation(async ({ input }) => {
    await deleteDomain(input.id);
    return { success: true };
  }),

  sendTestEmailFromDomain: domainProcedure.mutation(
    async ({
      ctx: {
        session: { user },
        team,
      },
      input,
    }) => {
      const domain = await db.domain.findFirst({
        where: { id: input.id, teamId: team.id },
      });

      if (!domain) {
        throw new Error("Domínio não encontrado");
      }

      if (!user.email) {
        throw new Error("E-mail do usuário não encontrado");
      }

      return sendEmail({
        teamId: team.id,
        to: user.email,
        from: `hello@${domain.name}`,
        subject: "E-mail de teste do Madmail",
        text: "hello,\n\nMadmail is the best open source sending platform\n\ncheck out https://usesend.com",
        html: "<p>hello,</p><p>Madmail is the best open source sending platform<p><p>check out <a href='https://usesend.com'>usesend.com</a>",
      });
    }
  ),
});
