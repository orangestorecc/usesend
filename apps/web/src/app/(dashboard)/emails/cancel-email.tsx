"use client";

import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@usesend/ui/src/dialog";
import { api } from "~/trpc/react";
import React, { useState } from "react";
import { toast } from "@usesend/ui/src/toaster";
import { Trash2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@usesend/ui/src/form";

const cancelSchema = z.object({
  confirmation: z.string(),
});

export const CancelEmail: React.FC<{
  emailId: string;
}> = ({ emailId }) => {
  const [open, setOpen] = useState(false);
  const cancelEmailMutation = api.email.cancelEmail.useMutation();

  const utils = api.useUtils();

  const cancelForm = useForm<z.infer<typeof cancelSchema>>({
    resolver: zodResolver(cancelSchema),
  });

  async function onEmailCancel(values: z.infer<typeof cancelSchema>) {
    if (values.confirmation !== "cancel") {
      cancelForm.setError("confirmation", {
        message: "A confirmação não corresponde",
      });
      return;
    }

    cancelEmailMutation.mutate(
      {
        id: emailId,
      },
      {
        onSuccess: () => {
          utils.email.getEmail.invalidate({ id: emailId });
          setOpen(false);
          toast.success(`E-mail cancelado`);
        },
        onError: (e) => {
          toast.error(`Erro ao cancelar o e-mail: ${e.message}`);
        },
      },
    );
  }

  const confirmation = cancelForm.watch("confirmation");

  return (
    <Dialog
      open={open}
      onOpenChange={(_open) => (_open !== open ? setOpen(_open) : null)}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Trash2 className="h-4 w-4 text-red" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar e-mail</DialogTitle>
          <DialogDescription>
            Tem certeza de que deseja cancelar este e-mail? Esta ação não pode
            ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Form {...cancelForm}>
            <form
              onSubmit={cancelForm.handleSubmit(onEmailCancel)}
              className="space-y-4"
            >
              <FormField
                control={cancelForm.control}
                name="confirmation"
                render={({ field, formState }) => (
                  <FormItem>
                    <FormLabel>Digite "cancel" para confirmar</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    {formState.errors.confirmation ? (
                      <FormMessage />
                    ) : (
                      <FormDescription className="text-transparent">
                        .
                      </FormDescription>
                    )}
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={
                    cancelEmailMutation.isPending || confirmation !== "cancel"
                  }
                >
                  {cancelEmailMutation.isPending
                    ? "Cancelando..."
                    : "Cancelar e-mail"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CancelEmail;
