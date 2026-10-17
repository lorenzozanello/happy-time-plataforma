import type { Metadata } from "next";
import { unitHashes } from "../../src/domain/curriculum/fingerprint";
import { HappyPage } from "../_client/happy";
import { getRepository } from "../_server/curriculum";

export const metadata: Metadata = { title: "Happy" };

/**
 * La pantalla recibe las huellas de los 572 literales (no los textos): con ellas verifica que
 * lo que viene del almacenamiento del navegador o de la red es exactamente el literal de la release
 * antes de mostrarlo como institucional. Viajan solo con esta página.
 */
export default function Page() {
  return <HappyPage unitHashes={unitHashes(getRepository().release.units)} />;
}
