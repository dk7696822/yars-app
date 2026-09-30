import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import IconButton from "../../ui/IconButton";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const light = theme === "light";
  return (
    <IconButton label={light ? "Switch to dark mode" : "Switch to light mode"} onClick={toggleTheme} className="bg-transparent">
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-brass" />}
    </IconButton>
  );
}
