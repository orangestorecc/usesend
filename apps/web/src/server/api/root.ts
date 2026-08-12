import { domainRouter } from "~/server/api/routers/domain";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { apiRouter } from "./routers/api";
import { emailRouter } from "./routers/email";
import { teamRouter } from "./routers/team";
import { adminRouter } from "./routers/admin";
import { contactsRouter } from "./routers/contacts";
import { campaignRouter } from "./routers/campaign";
import { templateRouter } from "./routers/template";
import { billingRouter } from "./routers/billing";
import { invitationRouter } from "./routers/invitiation";
import { dashboardRouter } from "./routers/dashboard";
import { suppressionRouter } from "./routers/suppression";
import { limitsRouter } from "./routers/limits";
import { waitlistRouter } from "./routers/waitlist";
import { feedbackRouter } from "./routers/feedback";
import { webhookRouter } from "./routers/webhook";
import { mcpRouter } from "./routers/mcp";
import { contactImportRouter } from "./routers/contact-import";
import { platformIntegrationRouter } from "./routers/platform-integration";
import { apiLogRouter } from "./routers/api-log";
import { billingProfileRouter } from "./routers/billing-profile";
import { unsubscribePageRouter } from "./routers/unsubscribe-page";
import { paymentGatewayRouter } from "./routers/payment-gateway";
import { promoCodeRouter } from "./routers/promo-code";
import { planCatalogRouter } from "./routers/plan-catalog";
import { inboundRouter } from "./routers/inbound";
import { inboundAdminRouter } from "./routers/inbound-admin";
import { paymentsRouter } from "./routers/payments";
import { aiRouter } from "./routers/ai";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  domain: domainRouter,
  apiKey: apiRouter,
  email: emailRouter,
  team: teamRouter,
  admin: adminRouter,
  contacts: contactsRouter,
  campaign: campaignRouter,
  template: templateRouter,
  billing: billingRouter,
  invitation: invitationRouter,
  dashboard: dashboardRouter,
  suppression: suppressionRouter,
  limits: limitsRouter,
  waitlist: waitlistRouter,
  feedback: feedbackRouter,
  webhook: webhookRouter,
  mcp: mcpRouter,
  platformIntegration: platformIntegrationRouter,
  contactImport: contactImportRouter,
  apiLog: apiLogRouter,
  billingProfile: billingProfileRouter,
  unsubscribePage: unsubscribePageRouter,
  paymentGateway: paymentGatewayRouter,
  promoCode: promoCodeRouter,
  planCatalog: planCatalogRouter,
  inbound: inboundRouter,
  inboundAdmin: inboundAdminRouter,
  payments: paymentsRouter,
  ai: aiRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
