import { FaSun, FaMoon } from 'react-icons/fa';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 active:scale-95"
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <span className="sr-only">Toggle theme</span>
      {theme === 'light' ? (
        <FaMoon className="h-4 w-4 text-gray-600 transition-transform hover:rotate-12" />
      ) : (
        <FaSun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" />
      )}
    </button>
  );
}
