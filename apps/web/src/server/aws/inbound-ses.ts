import {
  SESClient,
  CreateReceiptRuleCommand,
  DeleteReceiptRuleCommand,
} from "@aws-sdk/client-ses";
import { env } from "~/env";
import { getAwsCredentialOptions } from "./credentials";
import { logger } from "../logger/log";

const RULE_SET = "madmail-inbound";

function ses() {
  return new SESClient({
    region: env.INBOUND_S3_REGION,
    ...getAwsCredentialOptions(),
  });
}

function ruleName(domainId: number) {
  return `inbound-${domainId}`;
}

/**
 * Liga/desliga o recebimento de e-mails de um domínio criando/removendo uma
 * SES Receipt Rule (uma por domínio) que grava os e-mails no bucket S3 inbound.
 */
export async function setDomainReceiving(
  domainId: number,
  domainName: string,
  enabled: boolean,
) {
  const bucket = env.INBOUND_S3_BUCKET;
  if (!bucket) {
    throw new Error("Recebimento não configurado (INBOUND_S3_BUCKET ausente).");
  }
  const client = ses();
  const name = ruleName(domainId);

  if (enabled) {
    try {
      await client.send(
        new CreateReceiptRuleCommand({
          RuleSetName: RULE_SET,
          Rule: {
            Name: name,
            Enabled: true,
            TlsPolicy: "Optional",
            Recipients: [domainName],
            ScanEnabled: true,
            Actions: [
              {
                S3Action: { BucketName: bucket, ObjectKeyPrefix: "inbound/" },
              },
            ],
          },
        }),
      );
    } catch (e) {
      const errName = (e as { name?: string }).name;
      if (
        errName !== "RuleAlreadyExists" &&
        errName !== "AlreadyExistsException"
      ) {
        throw e;
      }
    }
  } else {
    try {
      await client.send(
        new DeleteReceiptRuleCommand({ RuleSetName: RULE_SET, RuleName: name }),
      );
    } catch (e) {
      const errName = (e as { name?: string }).name;
      if (errName !== "RuleDoesNotExist") throw e; // idempotente
    }
  }

  logger.info(
    { domainId, domainName, enabled },
    "[Inbound] Receipt rule atualizada",
  );
}
