"use client";
/**
 * Servicios de la app en F3. Sin acceso ni Happy todavía (F4 y F5): sus contratos existen,
 * pero aquí responden con un error explícito y la interfaz no los ofrece.
 */
import { browserStorage } from "../../src/ui/app/storage";
import type { Services } from "../../src/ui/app/types";

const notYet = (what: string) => Promise.reject(new Error(`${what} llega en una próxima versión`));

export function createAppServices(): Services {
  return {
    auth: {
      requestCode: () => notYet("El acceso"),
      verifyCode: () => notYet("El acceso"),
    },
    happy: {
      respond: () => notYet("Happy"),
    },
    storage: browserStorage(),
  };
}
