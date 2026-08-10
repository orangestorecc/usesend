"use client";

import { useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { PlansModal } from "./plans-modal";

export function PlanUpgradeButton({
  product = "transactional",
  label = "Fazer upgrade",
}: {
  product?: "transactional" | "marketing";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <PlansModal open={open} onOpenChange={setOpen} defaultProduct={product} />
    </>
  );
}
