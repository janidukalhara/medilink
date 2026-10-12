import { ReactNode } from "react";
import Navbar from "../shared/Navbar";
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="workspace-shell admin-workspace">
      <Navbar />
      <main className="workspace-main pb-10">{children}</main>
    </div>
  );
}
