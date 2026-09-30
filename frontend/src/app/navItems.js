import {
  LayoutDashboard, ClipboardList, Users, FileText, HandCoins, Wallet, History, Warehouse, PackageMinus,
  ShoppingCart, Tags, Truck, Ruler, Layers, Sparkles, House,
} from "lucide-react";

export const NAV_GROUPS = [
  { title: "Sales", items: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/orders", label: "Orders", icon: ClipboardList },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/invoices", label: "Invoices", icon: FileText },
  ] },
  { title: "Money", items: [
    { to: "/dues", label: "Dues", icon: HandCoins },
    { to: "/expenses", label: "Expenses", icon: Wallet },
    { to: "/history", label: "History", icon: History },
  ] },
  { title: "Stock", items: [
    { to: "/stock", label: "Stock", icon: Warehouse },
    { to: "/stock-issues", label: "Stock issues", icon: PackageMinus },
    { to: "/purchase-orders", label: "Purchase orders", icon: ShoppingCart },
    { to: "/inventory-items", label: "Items", icon: Tags },
    { to: "/suppliers", label: "Suppliers", icon: Truck },
  ] },
  { title: "Setup", items: [
    { to: "/product-sizes", label: "Sizes", icon: Ruler },
    { to: "/plate-types", label: "Plate types", icon: Layers },
    { to: "/assistant", label: "Jarvis", icon: Sparkles },
  ] },
];

/** The four daily places on the phone tab bar; everything else is under More. */
export const TABS = [
  { to: "/", label: "Home", icon: House },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/expenses", label: "Expenses", icon: Wallet },
];

const tabPaths = new Set(TABS.map((t) => t.to));
export const MORE_ITEMS = NAV_GROUPS.flatMap((g) => g.items).filter((i) => !tabPaths.has(i.to) && i.to !== "/");

export const isPathActive = (pathname, to) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`));
