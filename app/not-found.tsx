import type { Metadata } from "next";
import { NotFoundPage } from "./_client/screens";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return <NotFoundPage />;
}
