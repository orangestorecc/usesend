"use client";

import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@usesend/ui/src/dialog";
import * as chrono from "chrono-node";
import { api } from "~/trpc/react";
import { useRef, useState } from "react";
import { Edit3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@usesend/ui/src/toaster";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "@usesend/ui/src/dropdown-menu";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@usesend/ui/src/command";

export const EditSchedule: React.FC<{
  emailId: string;
  scheduledAt: string | null;
}> = ({ emailId, scheduledAt }) => {
  const [open, setOpen] = useState(false);
  const [openSuggestions, setOpenSuggestions] = useState(true);
  const [scheduleInput, setScheduleInput] = useState(scheduledAt || "");
  const [scheduledAtTime, setScheduledAtTime] = useState<Date | null>(
    scheduledAt ? new Date(scheduledAt) : null
  );
  const updateEmailScheduledAtMutation =
    api.email.updateEmailScheduledAt.useMutation();

  const utils = api.useUtils();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleScheduleUpdate = () => {
    const parsedDate = chrono.parseDate(scheduleInput);
    if (!parsedDate) {
      toast.error("Data e hora inválidas");
      return;
    }

    updateEmailScheduledAtMutation.mutate(
      {
        id: emailId,
        scheduledAt: parsedDate.toISOString(),
      },
      {
        onSuccess: () => {
          utils.email.getEmail.invalidate({ id: emailId });
          setOpen(false);
          toast.success("Agendamento do e-mail atualizado com sucesso");
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScheduleInput(e.target.value);
    const parsedDate = chrono.parseDate(e.target.value);
    if (parsedDate) {
      setScheduledAtTime(parsedDate);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_open) => (_open !== open ? setOpen(_open) : null)}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit3 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar agendamento</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <div className="space-y-4">
            <div>
              <label htmlFor="scheduleInput" className="block mb-2">
                Agendar para
              </label>
              {/* <Input
                id="scheduleInput"
                value={scheduleInput}
                onChange={onInputChange}
                // onClick={() => setOpenSuggestions(true)}
                onFocus={() => setOpenSuggestions(true)}
                // onBlur={() => setOpenSuggestions(false)}
                placeholder="Enter date and time (e.g., tomorrow at 3pm)"
              />

              <DropdownMenu
                open={openSuggestions}
                onOpenChange={setOpenSuggestions}
              >
                <div className="w-full flex justify-center">
                  <DropdownMenuTrigger></DropdownMenuTrigger>
                </div>
                <DropdownMenuContent className=" min-w-[29rem]">
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Billing</DropdownMenuItem>
                  <DropdownMenuItem>Team</DropdownMenuItem>
                  <DropdownMenuItem>Subscription</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu> */}
              <CommandDialog
                open={openSuggestions}
                onOpenChange={setOpenSuggestions}
              >
                <CommandInput placeholder="Digite um comando ou busque..." />
                <CommandList>
                  <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                  <CommandGroup heading="Sugestões">
                    <CommandItem>Calendário</CommandItem>
                    <CommandItem>Buscar emoji</CommandItem>
                    <CommandItem>Calculadora</CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup heading="Configurações">
                    <CommandItem>Perfil</CommandItem>
                    <CommandItem>Faturamento</CommandItem>
                    <CommandItem>Configurações</CommandItem>
                  </CommandGroup>
                </CommandList>
              </CommandDialog>
            </div>
            <div className="flex justify-end">
              <Button
                className="w-[100px] bg-white hover:bg-gray-100 focus:bg-gray-100"
                onClick={handleScheduleUpdate}
                disabled={updateEmailScheduledAtMutation.isPending}
              >
                {updateEmailScheduledAtMutation.isPending
                  ? "Atualizando..."
                  : "Atualizar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditSchedule;
