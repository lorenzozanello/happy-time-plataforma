/**
 * Id de dispositivo firmado por el servidor (F5, revisión M2): el cliente no puede fabricarlo para
 * evadir los límites. Se emite en GET /api/happy al presentar el código del piloto.
 */
import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const sha = (s: string) => createHash("sha256").update(s).digest();

/** Clave de firma: secreto propio si existe; si no, derivada del código del piloto. */
function signingKey(): Buffer {
  const secret = process.env.HAPPY_DEVICE_SECRET ?? `device:${process.env.HAPPY_ACCESS_CODE ?? ""}`;
  return sha(secret);
}
const sign = (id: string) =>
  createHmac("sha256", signingKey()).update(id).digest("hex").slice(0, 24);

export function issueDevice(): string {
  const id = randomBytes(9).toString("base64url");
  return `${id}.${sign(id)}`;
}

/** Id del dispositivo si la firma es válida; si no, undefined. */
export function verifyDevice(token: string | null): string | undefined {
  if (!token || token.length > 80) return undefined;
  const [id, sig] = token.split(".");
  if (!id || !sig) return undefined;
  const expected = sign(id);
  if (sig.length !== expected.length) return undefined;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? id : undefined;
}
