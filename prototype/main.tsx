import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import releaseJson from "../curriculum/build/curriculum.2026-06.json";
import { createRepository } from "../src/domain/curriculum/repository";
import { CurriculumReleaseSchema } from "../src/domain/curriculum/schema";
import { buildSearchIndex } from "../src/domain/curriculum/search";
import { HappyResponseSchema } from "../src/domain/happy/schema";
import { buildCatalog, buildSearchBundle } from "../src/domain/curriculum/views";
import { App } from "../src/ui/App";
import { useStackNavigation } from "../src/ui/app/routes";
import { AppProvider } from "../src/ui/app/state";
import { themeCss } from "../src/ui/theme";
import "../src/ui/styles.css";
import { createPrototypeServices } from "./services";

const release = CurriculumReleaseSchema.parse(releaseJson);
const repo = createRepository(release);
const catalog = buildCatalog(repo);
const index = buildSearchIndex(release);
const fast = new URLSearchParams(window.location.search).has("rapido");
const services = createPrototypeServices(repo, index, { fast });
let bundle: Promise<ReturnType<typeof buildSearchBundle>> | undefined;
const loadSearch = () => (bundle ??= Promise.resolve(buildSearchBundle(repo)));

const isValidResponse = (v: unknown) => HappyResponseSchema.safeParse(v).success;

const style = document.createElement("style");
style.textContent = themeCss();
document.head.prepend(style);

function PrototypeRoot({ children }: { children: ReactNode }) {
  const navigation = useStackNavigation();
  return (
    <AppProvider
      catalog={catalog}
      repo={repo}
      loadSearch={loadSearch}
      services={services}
      navigation={navigation}
      checkResponse={isValidResponse}
    >
      {children}
    </AppProvider>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Falta #root");
createRoot(root).render(
  <StrictMode>
    <PrototypeRoot>
      <App />
    </PrototypeRoot>
  </StrictMode>,
);
