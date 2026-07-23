import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { FaMagic } from "react-icons/fa";
import Sidebar from "./Sidebar";
import Header from "./Header";
import BottomNav from "./BottomNav";

const MainLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="main-layout flex h-screen bg-gray-50 dark:bg-[#0d1210] overflow-hidden">
      {/* Desktop sidebar — on phones, navigation lives in the bottom tab bar */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar isCollapsed={isSidebarCollapsed} />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          onSidebarToggle={() => setIsSidebarCollapsed((value) => !value)}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        {/* Main content with page transition; bottom padding clears the mobile tab bar */}
        <main className="flex-1 overflow-y-auto">
          <div className="page-enter pb-24 lg:pb-0">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating assistant button — hidden while already on the assistant */}
      {!location.pathname.startsWith("/assistant") && (
        <button
          type="button"
          aria-label="Ask Jarvis"
          onClick={() => navigate("/assistant")}
          className="fixed bottom-24 lg:bottom-6 right-4 z-40 flex items-center justify-center h-12 w-12 rounded-full bg-primary text-white shadow-lg shadow-primary/30 active:scale-95 transition-all"
        >
          <FaMagic className="w-4 h-4" />
        </button>
      )}

      {/* Mobile bottom tab bar */}
      <BottomNav />
    </div>
  );
};

export default MainLayout;
