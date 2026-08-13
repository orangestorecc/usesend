import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@usesend/ui/src/card";
import { TextWithCopyButton } from "@usesend/ui/src/text-with-copy";
import { env } from "~/env";

export const dynamic = "force-dynamic";

export default function ExampleCard() {
  const host = env.SMTP_HOST;
  const user = env.SMTP_USER;

  return (
    <Card className="mt-9 max-w-xl">
      <CardHeader>
        <CardTitle>SMTP</CardTitle>
        <CardDescription>
          Envie e-mails usando SMTP em vez da API REST. Consulte a documentação
          para mais informações.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <strong>Host:</strong>
            <TextWithCopyButton
              className="ml-1 border bg-primary/10  rounded-lg mt-1 p-2 w-full "
              value={host}
            ></TextWithCopyButton>
          </div>
          <div>
            <strong>Porta:</strong>
            <TextWithCopyButton
              className="ml-1 rounded-lg mt-1 p-2 w-full bg-primary/10 font-mono"
              value={"465"}
            ></TextWithCopyButton>
            <p className="ml-1 mt-1 text-zinc-500 text-sm ">
              TLS direto (SSL) nas portas{" "}
              <strong className="font-mono">465</strong> e{" "}
              <strong className="font-mono">2465</strong>. Para STARTTLS use{" "}
              <strong className="font-mono">587</strong>,{" "}
              <strong className="font-mono">2587</strong> ou{" "}
              <strong className="font-mono">25</strong>.
            </p>
          </div>
          <div>
            <strong>Usuário:</strong>
            <TextWithCopyButton
              className="ml-1 rounded-lg mt-1 p-2 w-full bg-primary/10"
              value={user}
            ></TextWithCopyButton>
          </div>
          <div>
            <strong>Senha:</strong>
            <p className="ml-1 mt-1 rounded-lg border border-dashed p-2 text-sm text-zinc-500">
              Use uma API key da sua conta. Host e usuário acima são fixos — a
              API key é o único dado que identifica você.
            </p>
            <p className="ml-1 mt-1 text-sm">
              <Link
                href="/dev-settings/api-keys"
                className="underline underline-offset-2"
              >
                Gerenciar API keys
              </Link>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
