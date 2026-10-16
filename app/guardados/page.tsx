import type { Metadata } from "next";
import { SavedPage } from "../_client/saved";

export const metadata: Metadata = { title: "Guardados" };

export default function Page() {
  return <SavedPage />;
}
