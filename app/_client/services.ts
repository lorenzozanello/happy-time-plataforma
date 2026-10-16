"use client";
/**
 * Servicios de la app. Happy por HTTP (F5; disponible solo si el servidor la tiene encendida).
 * El acceso llega en F4: su contrato existe, pero aquí responde con un error explícito.
 */
import { browserStorage } from "../../src/ui/app/storage";
import type { Services } from "../../src/ui/app/types";
import { createHttpHappyService } from "./happy-http";

const notYet = (what: string) => Promise.reject(new Error(`${what} llega en una próxima versión`));

export function createAppServices(): Services {
  return {
    auth: {
      requestCode: () => notYet("El acceso"),
      verifyCode: () => notYet("El acceso"),
    },
    happy: createHttpHappyService(),
    storage: browserStorage(),
  };
}
