import { RouteLink } from "../components";
import { HappyLockup } from "../happy/HappyAvatar";

/** Happy aún no está disponible en este despliegue (F3: la Malla sale primero a producción). */
export function HappyComingSoon() {
  return (
    <div className="screen">
      <header className="screen__head">
        <HappyLockup />
        <h1 className="display">Happy llega pronto</h1>
        <p className="lead">
          Mientras tanto, toda la malla está disponible: experiencias, niveles, progresión y
          principios, con su referencia exacta.
        </p>
      </header>
      <div className="stack">
        <RouteLink to={{ name: "malla" }} className="btn btn--primary">
          Ir a la malla
        </RouteLink>
        <RouteLink to={{ name: "search" }} className="btn btn--secondary">
          Buscar en la malla
        </RouteLink>
      </div>
    </div>
  );
}
