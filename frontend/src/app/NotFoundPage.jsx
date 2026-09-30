import { Link } from "react-router-dom";
import { buttonClass } from "../ui/styles";

export default function NotFoundPage() {
  return (
    <div className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-4 text-center">
      <div>
        <p className="font-num text-6xl font-bold text-brass">404</p>
        <h1 className="mt-2 text-xl font-bold text-ink">This page doesn't exist</h1>
        <p className="mt-1 text-sm text-ink-2">The link may be old or mistyped.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/" className={buttonClass()}>Home</Link>
          <Link to="/orders" className={buttonClass({ variant: "secondary" })}>Orders</Link>
        </div>
      </div>
    </div>
  );
}
