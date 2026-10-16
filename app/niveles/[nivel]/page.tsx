import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildLevel } from "../../../src/domain/curriculum/views";
import { LevelPage } from "../../_client/screens";
import { getCatalog, getRepository } from "../../_server/curriculum";

type Props = { params: Promise<{ nivel: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getCatalog().levels.map((l) => ({ nivel: l.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = buildLevel(getRepository(), (await params).nivel);
  return data ? { title: data.level.labelLiteral } : {};
}

export default async function Page({ params }: Props) {
  const data = buildLevel(getRepository(), (await params).nivel);
  if (!data) notFound();
  return <LevelPage data={data} />;
}
