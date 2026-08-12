"use client";

import AutomationList from "./automation-list";
import CreateAutomation from "./create-automation";
import { H1 } from "@usesend/ui";

export default function AutomationsPage() {
  return (
    <div>
      <div className="flex justify-between items-center">
        <H1>Automações</H1>
        <CreateAutomation />
      </div>
      <AutomationList />
    </div>
  );
}
