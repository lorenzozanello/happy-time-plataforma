import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildFicha, codeToSlug, slugToCode } from "../../../src/domain/curriculum/views";
import { FichaPage } from "../../_client/ficha";
import { getCatalog, getRepository } from "../../_server/curriculum";

type Props = { params: Promise<{ codigo: string }> };

/** Las 20 fichas se generan en el build; cualquier otro código es 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return getCatalog().experiences.map((e) => ({ codigo: codeToSlug(e.code) }));
}

function load(codigo: string) {
  // Solo el slug canónico ("s2-1"): evita URLs duplicadas para la misma ficha.
  const code = slugToCode(codigo);
  return codeToSlug(code) === codigo ? buildFicha(getRepository(), code) : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = load((await params).codigo);
  return data ? { title: `${data.experience.code} · ${data.experience.title.text}` } : {};
}

export default async function Page({ params }: Props) {
  const data = load((await params).codigo);
  if (!data) notFound();
  return <FichaPage data={data} />;
}
