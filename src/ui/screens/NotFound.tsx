import { RouteLink } from "../components";

/** Página no encontrada (404) común al prototipo y a la app. */
export function NotFoundScreen() {
  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="display">No encontramos esta página</h1>
        <p className="lead">
          Puede que el enlace esté incompleto o que la página ya no exista. La malla completa sigue
          aquí.
        </p>
      </header>
      <div className="stack">
        <RouteLink to={{ name: "malla" }} className="btn btn--primary">
          Ir a la malla
        </RouteLink>
        <RouteLink to={{ name: "home" }} className="btn btn--secondary">
          Volver al inicio
        </RouteLink>
      </div>
    </div>
  );
}
