import type { Metadata } from "next";
import { SavedPage } from "../_client/screens";

export const metadata: Metadata = { title: "Guardados" };

export default function Page() {
  return <SavedPage />;
}
