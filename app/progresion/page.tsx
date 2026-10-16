import type { Metadata } from "next";
import { buildProgression } from "../../src/domain/curriculum/views";
import { ProgressionPage } from "../_client/reference";
import { getRepository } from "../_server/curriculum";

export const metadata: Metadata = { title: "Progresión" };

export default function Page() {
  return <ProgressionPage data={buildProgression(getRepository())} />;
}
