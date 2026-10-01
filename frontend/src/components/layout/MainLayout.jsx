import { Suspense, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import BottomNav from "./BottomNav";
import { PageSkeleton } from "../../ui/States";
import { routeMeta } from "../../app/routeMeta";
import { ASSISTANT_NAME } from "../../app/assistant";

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Forms have their own sticky save bar: no tab bar or floating button over it.
  const { hideNav } = routeMeta(pathname);

  return (
    <div className="main-layout flex h-screen overflow-hidden bg-canvas text-ink">
      <div className="hidden flex-shrink-0 lg:block">
        <Sidebar isCollapsed={collapsed} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onSidebarToggle={() => setCollapsed((v) => !v)} />
        <main className="flex-1 overflow-y-auto">
          <div className={`page-enter ${hideNav ? "" : "pb-24"} lg:pb-0`}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {!hideNav && !pathname.startsWith("/assistant") && (
        <button type="button" aria-label={`Ask ${ASSISTANT_NAME}`} onClick={() => navigate("/assistant")}
          className="fixed bottom-24 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-brass text-brass-on shadow-lg shadow-black/30 transition active:scale-95 lg:bottom-6">
          <span aria-hidden="true" className="assistant-ring absolute inset-0 rounded-full bg-brass/50" />
          <Sparkles className="assistant-wiggle relative h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {!hideNav && <BottomNav />}
    </div>
  );
};

export default MainLayout;
