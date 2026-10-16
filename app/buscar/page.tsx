import type { Metadata } from "next";
import { SearchPage } from "../_client/screens";

export const metadata: Metadata = { title: "Buscar" };

export default function Page() {
  return <SearchPage />;
}
