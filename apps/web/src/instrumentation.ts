import * as Sentry from "@sentry/nextjs";

import { initDomainVerificationJob } from "~/server/jobs/domain-verification-job";
import { isCloud, isEmailCleanupEnabled } from "~/utils/common";

let initialized = false;

/**
 * Captura erros de renderização de servidor (RSC, route handlers, server
 * actions) que o Next repassa em vez de deixar estourar.
 */
export const onRequestError = Sentry.captureRequestError;

/**
 * Add things here to be executed during server startup.
 *
 * more details here: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
    return;
  }

  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (process.env.NEXT_RUNTIME === "nodejs" && !initialized) {
    console.log("Registering instrumentation");

    // Antes de qualquer job subir, para que falha na inicialização deles já
    // chegue ao Sentry.
    await import("../sentry.server.config");

    const { EmailQueueService } = await import(
      "~/server/service/email-queue-service"
    );
    await EmailQueueService.init();

    /**
     * Send usage data to Stripe
     */
    if (isCloud()) {
      await import("~/server/jobs/usage-job");
    }

    if (process.env.REDIS_URL) {
      await initDomainVerificationJob();
    }

    if (isEmailCleanupEnabled()) {
      await import("~/server/jobs/cleanup-email-bodies");
    }

    const { CampaignSchedulerService } = await import(
      "~/server/jobs/campaign-scheduler-job"
    );
    await CampaignSchedulerService.start();

    const { AutomationSchedulerService } = await import(
      "~/server/jobs/automation-scheduler-job"
    );
    await AutomationSchedulerService.start();

    if (process.env.REDIS_URL) {
      const { initPlatformSyncScheduler } = await import(
        "~/server/jobs/platform-sync-scheduler-job"
      );
      await initPlatformSyncScheduler();

      const { initApiLogCleanupJob } = await import(
        "~/server/jobs/api-log-cleanup-job"
      );
      await initApiLogCleanupJob();

      if (process.env.INBOUND_S3_BUCKET) {
        const { initInboundPollJob } = await import(
          "~/server/jobs/inbound-poll-job"
        );
        await initInboundPollJob();
      }

      const { initSubscriptionBillingJob } = await import(
        "~/server/jobs/subscription-billing-job"
      );
      await initSubscriptionBillingJob();

      const { initPaymentLogCleanupJob } = await import(
        "~/server/jobs/payment-log-cleanup-job"
      );
      await initPaymentLogCleanupJob();

      const { initPendingChargeSyncJob } = await import(
        "~/server/jobs/pending-charge-sync-job"
      );
      await initPendingChargeSyncJob();

      const { initReputationEvaluationJob } = await import(
        "~/server/jobs/reputation-evaluation-job"
      );
      await initReputationEvaluationJob();

      const { initBillingLifecycleJob } = await import(
        "~/server/jobs/billing-lifecycle-job"
      );
      await initBillingLifecycleJob();
    }

    const { initAccountLifecycleJob } = await import(
      "~/server/jobs/account-lifecycle-job"
    );
    await initAccountLifecycleJob();

    initialized = true;
  }
}
