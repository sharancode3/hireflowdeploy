import { Outlet } from "react-router-dom";
import { Header } from "./Header";

export function PublicLayout() {
  return (
    <div className="page">
      <Header />
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
