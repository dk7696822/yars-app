import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div role="status" className="grid min-h-dvh place-items-center bg-canvas text-ink-2">
        <span className="flex items-center gap-2 text-sm"><Loader2 className="h-5 w-5 animate-spin text-brass" aria-hidden="true" />Loading…</span>
      </div>
    );
  }
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
