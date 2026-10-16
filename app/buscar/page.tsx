import type { Metadata } from "next";
import { SearchPage } from "../_client/search";

export const metadata: Metadata = { title: "Buscar" };

export default function Page() {
  return <SearchPage />;
}
