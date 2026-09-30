import { NavLink } from "react-router-dom";
import PropTypes from "prop-types";
import { NAV_GROUPS } from "../../app/navItems";

/** Desktop navigation, grouped by what the work is about. */
const Sidebar = ({ isCollapsed = false }) => {
  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive ? "bg-brass/15 text-brass" : "text-ink-2 hover:bg-raised hover:text-ink"}`;
  return (
    <aside className={`${isCollapsed ? "w-20" : "w-64"} flex h-full flex-col border-r border-line bg-surface transition-[width] duration-300`}>
      <div className={`flex items-center gap-3 border-b border-line ${isCollapsed ? "justify-center px-3 py-5" : "px-5 py-5"}`}>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brass font-num text-lg font-bold text-brass-on">Y</span>
        {!isCollapsed && <div><p className="font-num text-lg font-semibold text-ink">YARS</p><p className="text-xs text-ink-2">Non-woven bags</p></div>}
      </div>
      <nav aria-label="Main" className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            {!isCollapsed && <p className="px-3 pb-1 text-xs font-semibold text-ink-2">{group.title}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.to === "/"} className={linkClass} title={isCollapsed ? item.label : undefined}>
                    <item.icon className={`h-[18px] w-[18px] shrink-0 ${isCollapsed ? "mx-auto" : ""}`} aria-hidden="true" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
};

Sidebar.propTypes = { isCollapsed: PropTypes.bool };

export default Sidebar;
