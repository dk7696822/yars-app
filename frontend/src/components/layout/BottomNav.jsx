import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Ellipsis } from "lucide-react";
import Sheet from "../../ui/Sheet";
import { TABS, MORE_ITEMS, isPathActive } from "../../app/navItems";

/** Phone tab bar: four daily places + More (a sheet with every other screen). Hidden on lg+. */
const BottomNav = () => {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);
  const moreActive = MORE_ITEMS.some((i) => isPathActive(pathname, i.to));

  const tabClass = (active) => `flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-brass/15 text-brass" : "text-ink-2"}`;

  return (
    <>
      <Sheet open={moreOpen} title="More" onClose={() => setMoreOpen(false)}>
        <div className="grid grid-cols-3 gap-2">
          {MORE_ITEMS.map((item) => {
            const active = isPathActive(pathname, item.to);
            return (
              <NavLink key={item.to} to={item.to} className={`flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center ${active ? "bg-brass/15 text-brass" : "text-ink hover:bg-raised"}`}>
                <item.icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-medium leading-tight">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </Sheet>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="grid h-16 grid-cols-5">
          {TABS.map((tab) => {
            const active = isPathActive(pathname, tab.to);
            return (
              <NavLink key={tab.to} to={tab.to} aria-current={active ? "page" : undefined} className="flex flex-col items-center justify-center gap-1">
                <span className={tabClass(active)}><tab.icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                <span className={`text-[10px] font-semibold ${active ? "text-brass" : "text-ink-2"}`}>{tab.label}</span>
              </NavLink>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen} className="flex flex-col items-center justify-center gap-1">
            <span className={tabClass(moreActive || moreOpen)}><Ellipsis className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <span className={`text-[10px] font-semibold ${moreActive || moreOpen ? "text-brass" : "text-ink-2"}`}>More</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
