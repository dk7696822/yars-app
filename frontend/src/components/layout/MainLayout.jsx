import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import BottomNav from "./BottomNav";

const MainLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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

      {/* Mobile bottom tab bar */}
      <BottomNav />
    </div>
  );
};

export default MainLayout;
