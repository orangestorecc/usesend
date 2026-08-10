"use client";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@usesend/ui/src/table";
import { api } from "~/trpc/react";
import { useUrlState } from "~/hooks/useUrlState";
import { Button } from "@usesend/ui/src/button";
import { LayoutTemplate } from "lucide-react";
import { EmptyState } from "~/components/EmptyState";
import { TableRowsSkeleton } from "~/components/skeletons";
import { formatDistanceToNow } from "date-fns";
// import DeleteCampaign from "./delete-campaign";
import Link from "next/link";
// import DuplicateCampaign from "./duplicate-campaign";

import { TextWithCopyButton } from "@usesend/ui/src/text-with-copy";
import DeleteTemplate from "./delete-template";
import DuplicateTemplate from "./duplicate-template";

export default function TemplateList() {
  const [page, setPage] = useUrlState("page", "1");

  const pageNumber = Number(page);

  const templateQuery = api.template.getTemplates.useQuery({
    page: pageNumber,
  });

  return (
    <div className="mt-10 flex flex-col gap-4">
      <div className="flex flex-col rounded-xl border border-border shadow">
        <Table className="">
          <TableHeader className="">
            <TableRow className=" bg-muted/30">
              <TableHead className="rounded-tl-xl">Nome</TableHead>
              <TableHead className="">ID</TableHead>
              <TableHead className="">Criado em</TableHead>
              <TableHead className="rounded-tr-xl">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templateQuery.isLoading ? (
              <TableRowsSkeleton rows={6} cols={4} />
            ) : templateQuery.data?.templates.length ? (
              templateQuery.data?.templates.map((template) => (
                <TableRow key={template.id} className="">
                  <TableCell className="font-medium">
                    <Link
                      className="underline underline-offset-4 decoration-dashed text-foreground hover:text-foreground"
                      href={`/templates/${template.id}/edit`}
                    >
                      {template.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <TextWithCopyButton
                      value={template.id}
                      className="w-[200px] overflow-hidden"
                    />
                  </TableCell>
                  <TableCell className="">
                    {formatDistanceToNow(new Date(template.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <DuplicateTemplate template={template} />
                      <DeleteTemplate template={template} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="p-0">
                  <EmptyState
                    icon={LayoutTemplate}
                    title="Nenhum template encontrado"
                    description="Crie um template para reutilizar em campanhas e e-mails."
                    className="border-0 bg-transparent"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex gap-4 justify-end">
        <Button
          size="sm"
          onClick={() => setPage((pageNumber - 1).toString())}
          disabled={pageNumber === 1}
        >
          Anterior
        </Button>
        <Button
          size="sm"
          onClick={() => setPage((pageNumber + 1).toString())}
          disabled={pageNumber >= (templateQuery.data?.totalPage ?? 0)}
        >
          Próximo
        </Button>
      </div>
    </div>
  );
}
