import type { Metadata } from "next";
import { HomePage } from "./_client/home";

export const metadata: Metadata = { title: { absolute: "Happy Time · Malla curricular" } };

export default function Page() {
  return <HomePage />;
}
