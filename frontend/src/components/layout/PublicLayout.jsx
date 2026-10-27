import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import PublicNavbar from "./PublicNavbar";
import Footer from "./Footer";
import PageLoader from "../ui/PageLoader";

export default function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicNavbar />
      {/* overflow-x-clip stops floating decorations from causing sideways scroll on phones */}
      <main className="flex-1 overflow-x-clip">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
