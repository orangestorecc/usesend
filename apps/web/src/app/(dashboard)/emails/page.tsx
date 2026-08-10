"use client";

import EmailList from "./email-list";
import ReceivedEmails from "./received-emails";
import { H1 } from "@usesend/ui";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@usesend/ui/src/tabs";

export default function EmailsPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <H1>E-mails</H1>
      </div>
      <Tabs defaultValue="sent" className="mt-4">
        <TabsList>
          <TabsTrigger value="sent">Enviados</TabsTrigger>
          <TabsTrigger value="received">Recebidos</TabsTrigger>
        </TabsList>
        <TabsContent value="sent">
          <EmailList />
        </TabsContent>
        <TabsContent value="received">
          <ReceivedEmails />
        </TabsContent>
      </Tabs>
    </div>
  );
}
