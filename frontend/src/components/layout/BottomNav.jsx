import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  FaHome,
  FaBoxes,
  FaWarehouse,
  FaUsers,
  FaEllipsisH,
  FaLayerGroup,
  FaRuler,
  FaMoneyBillWave,
  FaDolly,
  FaClipboardList,
  FaTags,
  FaTruck,
  FaFileInvoiceDollar,
  FaHistory,
} from "react-icons/fa";

/**
 * App-style bottom tab bar for phones. The four daily destinations get
 * permanent tabs; everything else lives behind "More" as a bottom sheet.
 * Hidden on lg+ where the sidebar takes over.
 */

const TABS = [
  { to: "/", icon: FaHome, label: "Home" },
  { to: "/orders", icon: FaBoxes, label: "Orders" },
  { to: "/stock", icon: FaWarehouse, label: "Stock" },
  { to: "/customers", icon: FaUsers, label: "Customers" },
];

const MORE_ITEMS = [
  { to: "/expenses", icon: FaMoneyBillWave, label: "Expenses" },
  { to: "/invoices", icon: FaFileInvoiceDollar, label: "Invoices" },
  { to: "/stock-issues", icon: FaDolly, label: "Stock Issues" },
  { to: "/purchase-orders", icon: FaClipboardList, label: "Purchases" },
  { to: "/inventory-items", icon: FaTags, label: "Items" },
  { to: "/suppliers", icon: FaTruck, label: "Suppliers" },
  { to: "/plate-types", icon: FaLayerGroup, label: "Plate Types" },
  { to: "/product-sizes", icon: FaRuler, label: "Sizes" },
  { to: "/history", icon: FaHistory, label: "History" },
];

const isPathActive = (pathname, to) =>
  to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);

const BottomNav = () => {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  // Route changes (from the sheet or anywhere else) close the sheet.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [moreOpen]);

  const moreActive = MORE_ITEMS.some((item) => isPathActive(location.pathname, item.to));

  return (
    <>
      {/* More sheet */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setMoreOpen(false)}
          />
          <div className="sheet-up absolute inset-x-0 bottom-0 rounded-t-3xl bg-white dark:bg-[#111916] border-t border-gray-200/60 dark:border-emerald-900/30 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.35)] pb-safe">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-emerald-900/60" />
            </div>
            <p className="px-6 pt-1 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              All modules
            </p>
            <div className="grid grid-cols-3 gap-2 px-4 pb-6">
              {MORE_ITEMS.map((item) => {
                const active = isPathActive(location.pathname, item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`press-scale flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center ${
                      active
                        ? "bg-primary/10 dark:bg-emerald-500/15 text-primary dark:text-emerald-400"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-emerald-500/5"
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center w-11 h-11 rounded-xl ${
                        active
                          ? "bg-primary/15 dark:bg-emerald-500/20"
                          : "bg-gray-100 dark:bg-emerald-500/10"
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-medium leading-tight">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <nav
        className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-white/90 dark:bg-[#0d1210]/95 backdrop-blur-xl border-t border-gray-200/70 dark:border-emerald-900/30 pb-safe"
        aria-label="Primary"
      >
        <div className="grid grid-cols-5 h-16">
          {TABS.map((tab) => {
            const active = isPathActive(location.pathname, tab.to);
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className="press-scale flex flex-col items-center justify-center gap-1"
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-200 ${
                    active ? "bg-primary/10 dark:bg-emerald-500/15" : "bg-transparent"
                  }`}
                >
                  <tab.icon
                    className={`w-[18px] h-[18px] transition-colors duration-200 ${
                      active
                        ? "text-primary dark:text-emerald-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  />
                </span>
                <span
                  className={`text-[10px] font-semibold tracking-wide ${
                    active
                      ? "text-primary dark:text-emerald-400"
                      : "text-gray-500 dark:text-gray-500"
                  }`}
                >
                  {tab.label}
                </span>
              </NavLink>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className="press-scale flex flex-col items-center justify-center gap-1"
            aria-expanded={moreOpen}
            aria-label="More modules"
          >
            <span
              className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-200 ${
                moreActive || moreOpen ? "bg-primary/10 dark:bg-emerald-500/15" : "bg-transparent"
              }`}
            >
              <FaEllipsisH
                className={`w-[18px] h-[18px] transition-colors duration-200 ${
                  moreActive || moreOpen
                    ? "text-primary dark:text-emerald-400"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              />
            </span>
            <span
              className={`text-[10px] font-semibold tracking-wide ${
                moreActive || moreOpen
                  ? "text-primary dark:text-emerald-400"
                  : "text-gray-500 dark:text-gray-500"
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
