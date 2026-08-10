"use client";

import { formatDistanceToNow } from "date-fns";
import { api } from "~/trpc/react";
import DeleteContactBook from "./delete-contact-book";
import Link from "next/link";
import EditContactBook from "./edit-contact-book";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUrlState } from "~/hooks/useUrlState";
import { Input } from "@usesend/ui/src/input";
import { useDebouncedCallback } from "use-debounce";
import { BookUser } from "lucide-react";
import { Skeleton } from "@usesend/ui/src/skeleton";
import { EmptyState } from "~/components/EmptyState";

export default function ContactBooksList() {
  const [search, setSearch] = useUrlState("search");
  const contactBooksQuery = api.contacts.getContactBooks.useQuery({
    search: search ?? undefined,
  });

  const router = useRouter();

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 1000);

  return (
    <div className="mt-10">
      <Input
        placeholder="Buscar lista de contatos"
        className="w-[300px] mr-4 mb-4"
        defaultValue={search ?? ""}
        onChange={(e) => debouncedSearch(e.target.value)}
      />
      {contactBooksQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-40 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-md" />
              </div>
              <Skeleton className="mt-6 h-3 w-24 rounded-md" />
            </div>
          ))}
        </div>
      ) : !contactBooksQuery.data?.length ? (
        <EmptyState
          icon={BookUser}
          title={search ? "Nenhuma lista encontrada" : "Nenhuma lista de contatos"}
          description={
            search
              ? "Tente ajustar sua busca."
              : "Crie sua primeira lista para organizar seus contatos."
          }
        />
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 ">
        {contactBooksQuery.data?.map((contactBook) => (
          <motion.div
            key={contactBook.id}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 200, damping: 10 }}
            whileTap={{ scale: 0.99 }}
            className="border rounded-xl shadow hover:shadow-lg"
          >
            <div className="flex flex-col">
              <Link href={`/contacts/${contactBook.id}`} key={contactBook.id}>
                <div className="flex justify-between items-center p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div>{contactBook.emoji}</div>
                    <div className="font-semibold truncate whitespace-nowrap overflow-ellipsis w-[180px]">
                      {contactBook.name}
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="font-mono">
                      {contactBook._count.contacts}
                    </span>{" "}
                    contatos
                  </div>
                </div>
              </Link>

              <div className="flex justify-between items-center border-t  bg-muted/50">
                <div
                  className="text-muted-foreground text-xs cursor-pointer w-full py-3 pl-4"
                  onClick={() => router.push(`/contacts/${contactBook.id}`)}
                >
                  {formatDistanceToNow(contactBook.createdAt, {
                    addSuffix: true,
                  })}
                </div>
                <div className="flex gap-3 pr-4">
                  <EditContactBook contactBook={contactBook} />
                  <DeleteContactBook contactBook={contactBook} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      )}
    </div>
  );
}
