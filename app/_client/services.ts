"use client";
/**
 * Servicios de la app. F5: Happy real contra /api/happy (con código de acceso del piloto hasta
 * F4). El acceso (F4) sigue con su contrato definido pero sin implementación: la interfaz no lo
 * ofrece todavía.
 */
import { browserStorage } from "../../src/ui/app/storage";
import type { Services } from "../../src/ui/app/types";
import { createHappyAccess, createHappyClient } from "./happy-client";

const notYet = (what: string) => Promise.reject(new Error(`${what} llega en una próxima versión`));

export function createAppServices(): Services {
  const storage = browserStorage();
  return {
    auth: {
      requestCode: () => notYet("El acceso"),
      verifyCode: () => notYet("El acceso"),
    },
    happy: createHappyClient(storage),
    happyAccess: createHappyAccess(storage),
    storage,
  };
}
