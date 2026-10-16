import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import releaseJson from "../curriculum/build/curriculum.2026-06.json";
import { createRepository } from "../src/domain/curriculum/repository";
import { CurriculumReleaseSchema } from "../src/domain/curriculum/schema";
import { buildSearchIndex } from "../src/domain/curriculum/search";
import { App } from "../src/ui/App";
import { AppProvider } from "../src/ui/app/state";
import { themeCss } from "../src/ui/theme";
import "../src/ui/styles.css";
import { createPrototypeServices } from "./services";

const release = CurriculumReleaseSchema.parse(releaseJson);
const repo = createRepository(release);
const index = buildSearchIndex(release);
const fast = new URLSearchParams(window.location.search).has("rapido");
const services = createPrototypeServices(repo, index, { fast });

const style = document.createElement("style");
style.textContent = themeCss();
document.head.prepend(style);

const root = document.getElementById("root");
if (!root) throw new Error("Falta #root");
createRoot(root).render(
  <StrictMode>
    <AppProvider repo={repo} search={index} services={services}>
      <App />
    </AppProvider>
  </StrictMode>,
);
