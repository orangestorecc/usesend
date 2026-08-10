import { db } from "~/server/db";
import { format, subDays } from "date-fns";
import { Prisma, Team } from "@prisma/client";

type EmailTimeSeries = {
  days?: number;
  domain?: number;
  campaignId?: string;
  team: Team;
};

export async function emailTimeSeries(input: EmailTimeSeries) {
  const days = input.days !== 7 ? 30 : 7;
  const { domain, campaignId, team } = input;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const isoStartDate = startDate.toISOString().split("T")[0];

  type DailyEmailUsage = {
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
  };

  // Com campanha selecionada, agrega por EmailEvent+Email (que tem campaignId);
  // senão, usa a tabela pré-agregada DailyEmailUsage.
  const result = campaignId
    ? await db.$queryRaw<Array<DailyEmailUsage>>`
        SELECT
          to_char(date_trunc('day', ev."createdAt"), 'YYYY-MM-DD') AS date,
          COUNT(*) FILTER (WHERE ev.status = 'SENT')::integer AS sent,
          COUNT(*) FILTER (WHERE ev.status = 'DELIVERED')::integer AS delivered,
          COUNT(*) FILTER (WHERE ev.status = 'OPENED')::integer AS opened,
          COUNT(*) FILTER (WHERE ev.status = 'CLICKED')::integer AS clicked,
          COUNT(*) FILTER (WHERE ev.status = 'BOUNCED')::integer AS bounced,
          COUNT(*) FILTER (WHERE ev.status = 'COMPLAINED')::integer AS complained
        FROM "EmailEvent" ev
        JOIN "Email" e ON e.id = ev."emailId"
        WHERE e."teamId" = ${team.id}
        AND e."campaignId" = ${campaignId}
        AND ev."createdAt" >= ${startDate}
        GROUP BY 1
        ORDER BY 1 ASC
      `
    : await db.$queryRaw<Array<DailyEmailUsage>>`
        SELECT
          date,
          SUM(sent)::integer AS sent,
          SUM(delivered)::integer AS delivered,
          SUM(opened)::integer AS opened,
          SUM(clicked)::integer AS clicked,
          SUM(bounced)::integer AS bounced,
          SUM(complained)::integer AS complained
        FROM "DailyEmailUsage"
        WHERE "teamId" = ${team.id}
        AND "date" >= ${isoStartDate}
        ${domain ? Prisma.sql`AND "domainId" = ${domain}` : Prisma.sql``}
        GROUP BY "date"
        ORDER BY "date" ASC
      `;

  // Fill in any missing dates with 0 values
  const filledResult: DailyEmailUsage[] = [];
  const endDateObj = new Date();

  for (let i = days; i > -1; i--) {
    const dateStr = subDays(endDateObj, i)
      .toISOString()
      .split("T")[0] as string;
    const existingData = result.find((r) => r.date === dateStr);

    if (existingData) {
      filledResult.push({
        ...existingData,
        date: format(dateStr, "MMM dd"),
      });
    } else {
      filledResult.push({
        date: format(dateStr, "MMM dd"),
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
      });
    }
  }

  const totalCounts = result.reduce(
    (acc, curr) => {
      acc.sent += curr.sent;
      acc.delivered += curr.delivered;
      acc.opened += curr.opened;
      acc.clicked += curr.clicked;
      acc.bounced += curr.bounced;
      acc.complained += curr.complained;
      return acc;
    },
    {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
    },
  );

  return { result: filledResult, totalCounts };
}

type ReputationMetricsData = {
  domain?: number;
  campaignId?: string;
  team: Team;
};

export async function reputationMetricsData(input: ReputationMetricsData) {
  const { domain, campaignId, team } = input;

  // Com campanha selecionada, usa os contadores da própria Campaign.
  if (campaignId) {
    const campaign = await db.campaign.findFirst({
      where: { id: campaignId, teamId: team.id },
      select: { delivered: true, hardBounced: true, complained: true },
    });
    const delivered = campaign?.delivered ?? 0;
    const hardBounced = campaign?.hardBounced ?? 0;
    const complained = campaign?.complained ?? 0;
    return {
      delivered,
      hardBounced,
      complained,
      bounceRate: delivered ? (hardBounced / delivered) * 100 : 0,
      complaintRate: delivered ? (complained / delivered) * 100 : 0,
    };
  }

  const reputations = await db.cumulatedMetrics.findMany({
    where: {
      teamId: team.id,
      ...(domain ? { domainId: domain } : {}),
    },
  });

  const results = reputations.reduce(
    (acc, curr) => {
      acc.delivered += Number(curr.delivered);
      acc.hardBounced += Number(curr.hardBounced);
      acc.complained += Number(curr.complained);
      return acc;
    },
    { delivered: 0, hardBounced: 0, complained: 0 },
  );

  const resultWithRates = {
    ...results,
    bounceRate: results.delivered
      ? (results.hardBounced / results.delivered) * 100
      : 0,
    complaintRate: results.delivered
      ? (results.complained / results.delivered) * 100
      : 0,
  };

  return resultWithRates;
}
