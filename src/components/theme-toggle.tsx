"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = mounted ? (theme === "system" ? resolvedTheme : theme) : null;

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={() => setTheme(current === "dark" ? "light" : "dark")}
      className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border text-foreground/70 hover:text-foreground hover:bg-secondary transition-colors"
      aria-label="Toggle theme"
    >
      {current === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
