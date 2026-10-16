import type { LevelId } from "../../domain/curriculum/fields";
import type { HappyContext, HappyResponse, Mode } from "../../domain/happy/schema";

export interface Session {
  email: string;
  role: "docente" | "coordinacion" | "admin";
}

/** Contrato de autenticación (F4 lo implementa con Supabase Auth, código OTP por correo). */
export interface AuthService {
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<Session>;
}

export interface HappyRequest {
  mode: Mode;
  message: string;
  context: HappyContext;
}

/** Contrato de Happy (F5 lo implementa con /api/happy). Entrega bloques a medida que llegan. */
export interface HappyService {
  respond(req: HappyRequest, onProgress: (partial: HappyResponse) => void): Promise<HappyResponse>;
}

export interface Services {
  auth: AuthService;
  happy: HappyService;
  /** Persistencia por navegador (prototipo). F4 la reemplaza por la base de datos. */
  storage: KeyValueStorage;
  /** Controles exclusivos del prototipo (ausentes en producción). */
  prototype?: { setFailHappy(v: boolean): void; getFailHappy(): boolean };
}

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface WorkContext {
  levelIds: LevelId[];
  periodIndex?: number;
  lastExperience?: string;
  lastThreadId?: string;
  onboarded: boolean;
  principleSeen?: boolean;
}

export type FavoriteTarget =
  { type: "experience"; code: string } | { type: "unit"; unitId: string };

export interface Favorite {
  id: string;
  target: FavoriteTarget;
  release: string;
  createdAt: number;
}

export interface SavedIdea {
  id: string;
  title: string;
  text: string;
  sourceUnitIds: string[];
  experienceCode?: string;
  threadId?: string;
  release: string;
  createdAt: number;
}

export interface ThreadMessage {
  id: string;
  role: "docente" | "happy";
  /** Mensaje de la docente: siempre la versión redactada por la política de privacidad. */
  text?: string;
  /** Modo con que se envió el mensaje (para reintentar igual). */
  mode?: Mode;
  /** Respuesta o error: id del mensaje de la docente al que responde. */
  replyTo?: string;
  response?: HappyResponse;
  error?: string;
  feedback?: "up" | "down";
  createdAt: number;
}

export interface Thread {
  id: string;
  mode: Mode;
  context: HappyContext;
  title: string;
  messages: ThreadMessage[];
  updatedAt: number;
}

export type Route =
  | { name: "home" }
  | { name: "malla"; levelId?: LevelId; periodIndex?: number }
  | { name: "ficha"; code: string; section?: string }
  | { name: "search"; q?: string }
  | { name: "level"; levelId: LevelId }
  | { name: "progression" }
  | { name: "principles" }
  | { name: "happy"; threadId?: string; mode?: Mode; context?: HappyContext }
  | { name: "saved"; tab?: "favoritos" | "ideas" | "planeaciones" }
  | { name: "identity" }
  | { name: "tools" }
  | { name: "notFound" };

export type TabName = "home" | "malla" | "happy" | "saved";

export function tabOf(route: Route): TabName | undefined {
  switch (route.name) {
    case "home":
      return "home";
    case "happy":
      return "happy";
    case "saved":
      return "saved";
    case "identity":
    case "tools":
      return "home";
    case "notFound":
      return undefined;
    default:
      return "malla";
  }
}
