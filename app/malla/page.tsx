import type { Metadata } from "next";
import { MallaPage } from "../_client/screens";

export const metadata: Metadata = { title: "Malla" };

export default function Page() {
  return <MallaPage />;
}
