/**
 * Paquete de búsqueda (textos + índice) como archivo estático versionado por release:
 * /datos/busqueda-<release>.json. Solo se descarga al abrir /buscar (F3-04).
 */
import { getSearchBundle, searchFileName } from "../../_server/curriculum";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ archivo: searchFileName() }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ archivo: string }> }) {
  if ((await params).archivo !== searchFileName()) return new Response(null, { status: 404 });
  return Response.json(getSearchBundle(), {
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
