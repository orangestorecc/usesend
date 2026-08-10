"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@usesend/ui/src/dialog";
import { Button } from "@usesend/ui/src/button";

interface RemoveSuppressionDialogProps {
  email: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export default function RemoveSuppressionDialog({
  email,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: RemoveSuppressionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover supressão</DialogTitle>
          <DialogDescription>
            Tem certeza de que deseja remover <strong>{email}</strong> da lista
            de supressões? Este e-mail poderá receber e-mails novamente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Removendo..." : "Remover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
