import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

const MainLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleSidebarToggle = () => {
    if (window.innerWidth < 1024) {
      setIsMobileOpen(!isMobileOpen);
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  // Close mobile sidebar on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Desktop sidebar - part of flex layout */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          isMobileOpen={isMobileOpen}
          onToggle={handleSidebarToggle}
        />
      </div>

      {/* Mobile sidebar - overlay */}
      <div className="lg:hidden">
        <Sidebar
          isCollapsed={false}
          isMobileOpen={isMobileOpen}
          onToggle={handleSidebarToggle}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          onSidebarToggle={handleSidebarToggle}
          isSidebarCollapsed={isSidebarCollapsed}
          isMobileOpen={isMobileOpen}
        />

        {/* Main content with page transition */}
        <main className="flex-1 overflow-y-auto">
          <div className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
