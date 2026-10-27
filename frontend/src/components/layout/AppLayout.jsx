import { Suspense } from "react";
import { Outlet, useMatch } from "react-router-dom";
import AppNavbar from "./AppNavbar";
import MobileTabBar from "./MobileTabBar";
import PageLoader from "../ui/PageLoader";
import SocketManager from "../../socket/SocketManager";

export default function AppLayout() {
  // The inbox fills the screen under the navbar like an app, so it skips the page padding.
  const fullBleed = Boolean(useMatch("/inbox/*"));

  return (
    <div className="min-h-dvh">
      <SocketManager />
      <AppNavbar />
      {/* Extra bottom padding on phones so the tab bar never covers content */}
      <main className={fullBleed ? "" : "mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6 sm:pt-8 md:pb-12"}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <MobileTabBar />
    </div>
  );
}
