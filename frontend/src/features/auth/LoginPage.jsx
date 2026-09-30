import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import Button from "../../ui/Button";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (isAuthenticated) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) return setError("Enter your username and password");
    setBusy(true);
    try {
      if (await login(username.trim(), password)) navigate("/", { replace: true });
      else setError("That username or password is wrong");
    } catch {
      setError("Couldn't reach the server. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brass font-num text-xl font-bold text-brass-on shadow-[0_8px_30px_rgb(var(--c-brass)/0.35)]">Y</div>
          <h1 className="mt-4 font-num text-2xl font-bold text-ink">YARS</h1>
          <p className="text-sm text-ink-2">Sign in to your factory's books</p>
        </div>
        <form onSubmit={submit} noValidate className="space-y-4 rounded-3xl bg-gradient-to-b from-raised to-surface p-5 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
          <Field label="Username" htmlFor="login-user">
            <TextInput autoComplete="username" autoCapitalize="none" autoCorrect="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <div className="relative">
            <Field label="Password" htmlFor="login-pass">
              <TextInput type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" />
            </Field>
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
              className="absolute bottom-0 right-0 grid h-12 w-12 place-items-center rounded-r-2xl text-ink-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && <p role="alert" className="rounded-xl bg-status-critical/10 px-3 py-2 text-sm font-medium text-status-critical">{error}</p>}
          <Button type="submit" block size="lg" loading={busy}>Sign in</Button>
        </form>
      </div>
    </main>
  );
}
