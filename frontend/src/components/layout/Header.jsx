import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { ChevronLeft, PanelLeft, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ThemeToggle } from "../theme/ThemeToggle";
import IconButton from "../../ui/IconButton";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { routeMeta } from "../../app/routeMeta";

const Header = ({ onSidebarToggle }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { title, back } = routeMeta(location.pathname);

  // Back returns to wherever you came from inside the app; opened from a link, it goes to the parent screen.
  const goBack = () => (location.key !== "default" ? navigate(-1) : navigate(back));

  return (
    <header className="sticky top-0 z-10 border-b border-line/70 bg-canvas/85 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
        <div className="flex min-w-0 items-center gap-1.5">
          <IconButton label="Collapse or expand the menu" onClick={onSidebarToggle} className="hidden bg-transparent lg:grid"><PanelLeft className="h-4 w-4" /></IconButton>
          {back && <IconButton label="Back" onClick={goBack} className="bg-transparent lg:hidden"><ChevronLeft className="h-5 w-5" /></IconButton>}
          <h1 className="truncate font-num text-lg font-semibold text-ink sm:hidden">{title}</h1>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden max-w-[8rem] truncate rounded-xl bg-surface px-3 py-1.5 text-sm text-ink-2 sm:inline">{user.username}</span>
            <IconButton label="Log out" onClick={() => setConfirmLogout(true)} className="bg-transparent"><LogOut className="h-4 w-4" /></IconButton>
          </div>
        )}
      </div>
      <ConfirmDialog open={confirmLogout} title="Log out?" message="You will need to sign in again to use the app." confirmLabel="Log out" cancelLabel="Stay" tone="primary"
        onConfirm={logout} onClose={() => setConfirmLogout(false)} />
    </header>
  );
};

Header.propTypes = { onSidebarToggle: PropTypes.func };

export default Header;
