import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

const MainLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Handle sidebar toggle
  const handleSidebarToggle = () => {
    if (window.innerWidth < 1024) {
      // Mobile: toggle mobile menu
      setIsMobileOpen(!isMobileOpen);
    } else {
      // Desktop: toggle collapsed state
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  // Close mobile menu on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Desktop sidebar - part of flex layout */}
      <div className="hidden lg:block">
        <Sidebar isCollapsed={isSidebarCollapsed} isMobileOpen={isMobileOpen} onToggle={handleSidebarToggle} />
      </div>

      {/* Mobile sidebar - overlay */}
      <div className="lg:hidden">
        <Sidebar isCollapsed={isSidebarCollapsed} isMobileOpen={isMobileOpen} onToggle={handleSidebarToggle} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onSidebarToggle={handleSidebarToggle} isSidebarCollapsed={isSidebarCollapsed} isMobileOpen={isMobileOpen} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
