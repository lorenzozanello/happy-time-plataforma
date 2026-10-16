import type { Metadata } from "next";
import { ProfilePage } from "../_client/profile";

export const metadata: Metadata = { title: "Tu perfil" };

export default function Page() {
  return <ProfilePage />;
}
