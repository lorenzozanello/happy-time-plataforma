import type { Metadata } from "next";
import { NotFoundPage } from "./_client/notfound";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return <NotFoundPage />;
}
