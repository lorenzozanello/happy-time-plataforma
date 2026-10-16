import type { Metadata } from "next";
import { IdentityPage } from "../_client/screens";

export const metadata: Metadata = { title: "Identidad de Happy" };

export default function Page() {
  return <IdentityPage />;
}
