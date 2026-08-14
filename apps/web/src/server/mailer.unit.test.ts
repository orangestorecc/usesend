import { describe, it, expect, vi, beforeEach } from "vitest";

const domainFindFirst = vi.fn();
const sendEmailMock = vi.fn();

vi.mock("~/env", () => ({
  env: {
    NODE_ENV: "production",
    FROM_EMAIL: "contato@madmail.com.br",
    USESEND_API_KEY: undefined,
    UNSEND_API_KEY: undefined,
  },
}));

vi.mock("./db", () => ({
  db: { domain: { findFirst: (...args: unknown[]) => domainFindFirst(...args) } },
}));

vi.mock("./service/email-service", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

vi.mock("./logger/log", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("./email-templates", () => ({
  renderOtpEmail: vi.fn(),
  renderTeamInviteEmail: vi.fn(),
}));

import { sendMail } from "./mailer";

describe("sendMail (envio interno)", () => {
  beforeEach(() => {
    domainFindFirst.mockReset();
    sendEmailMock.mockReset();
  });

  it("envia pelo time dono do domínio do FROM_EMAIL, não pelo primeiro time da base", async () => {
    domainFindFirst.mockResolvedValue({
      id: 1,
      name: "madmail.com.br",
      teamId: 1,
    });

    await sendMail("josuex220@gmail.com", "Convite", "texto", "<p>html</p>");

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 1,
        to: "josuex220@gmail.com",
        from: "contato@madmail.com.br",
        isSystemEmail: true,
      }),
    );
  });

  it("falha explicitamente quando não há domínio verificado", async () => {
    domainFindFirst.mockResolvedValue(null);

    await expect(
      sendMail("josuex220@gmail.com", "Convite", "texto", "<p>html</p>"),
    ).rejects.toThrow(/domínio verificado/i);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
