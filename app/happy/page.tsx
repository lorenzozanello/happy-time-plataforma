import type { Metadata } from "next";
import { HappyPage } from "../_client/happy";

export const metadata: Metadata = { title: "Happy" };

export default function Page() {
  return <HappyPage />;
}
