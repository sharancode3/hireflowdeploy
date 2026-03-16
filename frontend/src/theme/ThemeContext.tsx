import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ThemeName } from "./theme";
import { applyTheme, loadTheme, saveTheme } from "./theme";

type ThemeState = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  const value = useMemo<ThemeState>(
    () => ({
      theme,
      setTheme: (t) => setThemeState(t),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
