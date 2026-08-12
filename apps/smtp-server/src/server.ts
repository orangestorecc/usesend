import { SMTPServer, SMTPServerOptions, SMTPServerSession } from "smtp-server";
import { Readable } from "stream";
import dotenv from "dotenv";
import { simpleParser } from "mailparser";
import { readFileSync, watch, FSWatcher } from "fs";
import { extractForwardedHeaders } from "./email-headers";
import { drenar, iniciarSentry, reportar } from "./sentry";

dotenv.config();

// Depois do `dotenv.config()`, senão o SENTRY_DSN do .env ainda não existe.
iniciarSentry();

const AUTH_USERNAME = process.env.SMTP_AUTH_USERNAME ?? "madmail";
const BASE_URL =
  process.env.USESEND_BASE_URL ??
  process.env.UNSEND_BASE_URL ??
  "https://app.usesend.com";
const SSL_KEY_PATH =
  process.env.USESEND_API_KEY_PATH ?? process.env.UNSEND_API_KEY_PATH;
const SSL_CERT_PATH =
  process.env.USESEND_API_CERT_PATH ?? process.env.UNSEND_API_CERT_PATH;

/** O smtp-server usa `responseCode` para escolher o código devolvido ao cliente. */
type ErroSmtp = Error & { responseCode?: number };

async function sendEmailToUseSend(emailData: any, apiKey: string) {
  try {
    const apiEndpoint = "/api/v1/emails";
    const url = new URL(apiEndpoint, BASE_URL); // Combine base URL with endpoint
    console.log("Sending email to useSend API at:", url.href); // Debug statement

    const emailDataText = JSON.stringify(emailData);

    const response = await fetch(url.href, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: emailDataText,
    });

    if (!response.ok) {
      const errorData = await response.text();

      // 401/403 significam credencial errada, e isso não melhora com o tempo.
      // Devolver 4xx temporário aqui faria o cliente (WordPress, ERP) reenviar
      // para sempre com a mesma senha inválida, enchendo a fila dele e a nossa.
      if (response.status === 401 || response.status === 403) {
        const permanente = new Error(
          "Chave de API inválida. Use uma API key da Madmail como senha.",
        ) as ErroSmtp;
        permanente.responseCode = 535;
        throw permanente;
      }
      console.error(
        "useSend API error response: error:",
        JSON.stringify(errorData, null, 4),
        `\nemail data: ${emailDataText}`,
      );
      throw new Error(
        `Failed to send email: ${errorData || "Unknown error from server"}`,
      );
    }

    const responseData = await response.json();
    console.log("useSend API response:", responseData);
  } catch (error) {
    // Falha ao repassar para a API é o modo de falha que mais dói: o cliente
    // acha que entregou o email e ele nunca saiu.
    reportar(error, { etapa: "encaminhar-para-api", baseUrl: BASE_URL });

    if (error instanceof Error) {
      console.error("Error message:", error.message);
      // Sem isto o reembrulho apagaria o responseCode e o erro permanente
      // voltaria a ser tratado como temporário.
      if ((error as ErroSmtp).responseCode) {
        throw error;
      }
      throw new Error(`Failed to send email: ${error.message}`);
    } else {
      console.error("Unexpected error:", error);
      throw new Error("Failed to send email: Unexpected error occurred");
    }
  }
}

function loadCertificates(): { key?: Buffer; cert?: Buffer } {
  return {
    key: SSL_KEY_PATH ? readFileSync(SSL_KEY_PATH) : undefined,
    cert: SSL_CERT_PATH ? readFileSync(SSL_CERT_PATH) : undefined,
  };
}

const initialCerts = loadCertificates();

const serverOptions: SMTPServerOptions = {
  secure: false,
  key: initialCerts.key,
  cert: initialCerts.cert,
  onData(
    stream: Readable,
    session: SMTPServerSession,
    callback: (error?: Error) => void,
  ) {
    console.log("Receiving email data..."); // Debug statement
    simpleParser(stream, (err, parsed) => {
      if (err) {
        console.error("Failed to parse email data:", err.message);
        reportar(err, { etapa: "parse-email", remoteAddress: session.remoteAddress });
        return callback(err);
      }

      if (!session.user) {
        console.error("No API key found in session");
        return callback(new Error("No API key found in session"));
      }

      const forwardedHeaders = extractForwardedHeaders(parsed.headerLines);

      const emailObject = {
        to: Array.isArray(parsed.to)
          ? parsed.to.map((addr) => addr.text).join(", ")
          : parsed.to?.text,
        from: Array.isArray(parsed.from)
          ? parsed.from.map((addr) => addr.text).join(", ")
          : parsed.from?.text,
        subject: parsed.subject,
        text: parsed.text,
        html: parsed.html,
        replyTo: parsed.replyTo?.text,
        cc: Array.isArray(parsed.cc)
          ? parsed.cc.map((addr) => addr.text).join(", ")
          : parsed.cc?.text,
        bcc: Array.isArray(parsed.bcc)
          ? parsed.bcc.map((addr) => addr.text).join(", ")
          : parsed.bcc?.text,
        headers: forwardedHeaders,
        attachments:
          parsed.attachments.length > 0
            ? parsed.attachments.map((attachment, index) => ({
                filename: attachment.filename || `attachment-${index + 1}`,
                content: attachment.content.toString("base64"),
              }))
            : undefined,
      };

      sendEmailToUseSend(emailObject, session.user)
        .then(() => callback())
        .then(() => console.log("Email sent successfully to: ", emailObject.to))
        .catch((error) => {
          console.error("Failed to send email:", error.message);
          callback(error);
        });
    });
  },
  onAuth(auth, session: any, callback: (error?: Error, user?: any) => void) {
    if (auth.username === AUTH_USERNAME && auth.password) {
      console.log("Authenticated successfully"); // Debug statement
      callback(undefined, { user: auth.password });
    } else {
      console.error("Invalid username or password");
      callback(new Error("Invalid username or password"));
    }
  },
  size: 10485760,
};

/**
 * Portas configuráveis.
 *
 * Rodando como usuário sem privilégio não dá para abrir porta abaixo de 1024:
 * o processo tentaria 25/465/587 e levaria EACCES em todas. Por isso as
 * portas vêm do ambiente — em produção o serviço escuta nas altas (2465/2587)
 * e o proxy da borda mapeia 465/587 para elas.
 */
function portasDoAmbiente(variavel: string, padrao: number[]): number[] {
  const bruto = process.env[variavel];
  if (!bruto) return padrao;
  return bruto
    .split(",")
    .map((p) => Number(p.trim()))
    .filter((p) => Number.isInteger(p) && p > 0 && p < 65536);
}

const PORTAS_TLS = portasDoAmbiente("SMTP_TLS_PORTS", [465, 2465]);
const PORTAS_STARTTLS = portasDoAmbiente("SMTP_STARTTLS_PORTS", [25, 587, 2587]);

function startServers() {
  const servers: SMTPServer[] = [];
  const watchers: FSWatcher[] = [];

  if (SSL_KEY_PATH && SSL_CERT_PATH) {
    PORTAS_TLS.forEach((port) => {
      const server = new SMTPServer({ ...serverOptions, secure: true });

      server.listen(port, () => {
        console.log(
          `Implicit SSL/TLS SMTP server is listening on port ${port}`,
        );
      });

      server.on("error", (err) => {
        console.error(`Error occurred on port ${port}:`, err);
        reportar(err, { etapa: "servidor-smtp", port, modo: "implicit-tls" });
      });

      servers.push(server);
    });
  }

  PORTAS_STARTTLS.forEach((port) => {
    const server = new SMTPServer(serverOptions);

    server.listen(port, () => {
      console.log(`STARTTLS SMTP server is listening on port ${port}`);
    });

    server.on("error", (err) => {
      console.error(`Error occurred on port ${port}:`, err);
      reportar(err, { etapa: "servidor-smtp", port, modo: "starttls" });
    });

    servers.push(server);
  });

  if (SSL_KEY_PATH && SSL_CERT_PATH) {
    const reloadCertificates = () => {
      try {
        const { key, cert } = loadCertificates();
        if (key && cert) {
          servers.forEach((srv) => srv.updateSecureContext({ key, cert }));
          console.log("TLS certificates reloaded");
        }
      } catch (err) {
        // Certificado que para de recarregar vira expiração silenciosa dias
        // depois; queremos saber na primeira falha.
        console.error("Failed to reload TLS certificates", err);
        reportar(err, { etapa: "recarregar-certificado" });
      }
    };

    [SSL_KEY_PATH, SSL_CERT_PATH].forEach((file) => {
      watchers.push(watch(file, { persistent: false }, reloadCertificates));
    });
  }
  return { servers, watchers };
}

const { servers, watchers } = startServers();

function shutdown() {
  console.log("Shutting down SMTP server...");
  watchers.forEach((w) => w.close());
  servers.forEach((s) => s.close());
  // Dá ao Sentry a chance de despachar o que ficou na fila antes de sair.
  drenar().finally(() => process.exit(0));
}

["SIGINT", "SIGTERM", "SIGQUIT"].forEach((signal) => {
  process.on(signal, shutdown);
});
