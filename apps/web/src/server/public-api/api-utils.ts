import { Context } from "hono";
import { db } from "../db";
import { UnsendApiError } from "./api-error";

export const getContactBook = async (c: Context, teamId: number) => {
  const contactBookId = c.req.param("contactBookId");

  if (!contactBookId) {
    throw new UnsendApiError({
      code: "BAD_REQUEST",
      message: "contactBookId é obrigatório",
    });
  }

  const contactBook = await db.contactBook.findUnique({
    where: { id: contactBookId, teamId },
  });

  if (!contactBook) {
    throw new UnsendApiError({
      code: "NOT_FOUND",
      message: "Lista de contatos não encontrada para este time",
    });
  }

  return contactBook;
};

export const checkIsValidEmailId = async (emailId: string, teamId: number) => {
  const email = await db.email.findUnique({ where: { id: emailId, teamId } });

  if (!email) {
    throw new UnsendApiError({ code: "NOT_FOUND", message: "E-mail não encontrado" });
  }
};

export const checkIsValidEmailIdWithDomainRestriction = async (
  emailId: string, 
  teamId: number, 
  apiKeyDomainId?: number
) => {
  const whereClause: { id: string; teamId: number; domainId?: number } = {
    id: emailId,
    teamId,
  };

  if (apiKeyDomainId !== undefined) {
    whereClause.domainId = apiKeyDomainId;
  }

  const email = await db.email.findUnique({ where: whereClause });

  if (!email) {
    throw new UnsendApiError({ code: "NOT_FOUND", message: "E-mail não encontrado" });
  }

  return email;
};
