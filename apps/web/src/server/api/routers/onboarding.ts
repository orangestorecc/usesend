import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import * as onboardingService from "~/server/service/onboarding-service";

export const onboardingRouter = createTRPCRouter({
  getProgress: teamProcedure.query(async ({ ctx: { team } }) => {
    return onboardingService.getOnboardingProgress(team.id);
  }),

  dismissWelcome: teamProcedure.mutation(async ({ ctx: { team } }) => {
    await onboardingService.dismissWelcome(team.id);
    return { success: true };
  }),

  markReminded: teamProcedure.mutation(async ({ ctx: { team } }) => {
    await onboardingService.markReminded(team.id);
    return { success: true };
  }),

  snooze: teamProcedure.mutation(async ({ ctx: { team } }) => {
    await onboardingService.snoozeOnboarding(team.id);
    return { success: true };
  }),
});
