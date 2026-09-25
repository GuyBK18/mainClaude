import { Suspense } from "react";
import type { Metadata } from "next";
import { BookVault } from "@/components/vault/book-vault";

export const metadata: Metadata = { title: "Book" };

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <BookVault id={id} />
    </Suspense>
  );
}
