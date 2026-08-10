"use client";

import type { Contact } from "@prisma/client";
import { Button } from "@usesend/ui/src/button";
import Spinner from "@usesend/ui/src/spinner";
import { toast } from "@usesend/ui/src/toaster";
import { useState } from "react";
import { api } from "~/trpc/react";

export default function ReSubscribe({
  id,
  hash,
  contact,
}: {
  id: string;
  hash: string;
  contact: Contact;
}) {
  const [subscribed, setSubscribed] = useState(false);

  const reSubscribe = api.campaign.reSubscribeContact.useMutation({
    onSuccess: () => {
      toast.success("Você foi inscrito novamente");
      setSubscribed(true);
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  return (
    <div className="max-w-xl w-full space-y-8 p-10 border shadow rounded-xl">
      <h2 className=" text-center text-xl font-extrabold ">
        {subscribed ? "Você se inscreveu novamente" : "Você cancelou a inscrição"}
      </h2>
      <div>
        {subscribed
          ? "Você foi adicionado à nossa lista de e-mails e receberá todos os e-mails em"
          : "Você foi removido da nossa lista de e-mails e não receberá nenhum e-mail em"}{" "}
        <span className="font-bold">{contact.email}</span>.
      </div>

      <div className="flex justify-center">
        {!subscribed ? (
          <Button
            type="button"
            className="mx-auto min-h-11 w-[150px] touch-manipulation"
            onClick={() => reSubscribe.mutate({ id, hash })}
            disabled={reSubscribe.isPending}
            aria-disabled={reSubscribe.isPending}
          >
            {reSubscribe.isPending ? (
              <Spinner className="w-4 h-4" />
            ) : (
              "Inscrever novamente"
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
