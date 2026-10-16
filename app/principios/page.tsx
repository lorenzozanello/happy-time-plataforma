import type { Metadata } from "next";
import { buildPrinciples } from "../../src/domain/curriculum/views";
import { PrinciplesPage } from "../_client/screens";
import { getRepository } from "../_server/curriculum";

export const metadata: Metadata = { title: "Principios" };

export default function Page() {
  return <PrinciplesPage data={buildPrinciples(getRepository())} />;
}
