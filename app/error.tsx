"use client";
/** Error inesperado dentro de una página: se queda dentro del armazón, en español y con salida. */
import { ErrorState, RouteLink } from "../src/ui/components";

export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="display">Algo no salió bien</h1>
      </header>
      <ErrorState
        message="No pudimos mostrar esta página. Puedes intentarlo de nuevo o volver a la malla."
        onRetry={reset}
      />
      <RouteLink to={{ name: "malla" }} className="btn btn--secondary">
        Ir a la malla
      </RouteLink>
    </div>
  );
}
