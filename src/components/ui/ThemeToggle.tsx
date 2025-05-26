import React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "./Button";
import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../utils/cn";

interface ThemeToggleProps {
  variant?: "button" | "dropdown";
  className?: string;
}

export function ThemeToggle({ variant = "button", className }: ThemeToggleProps) {
  const { theme, actualTheme, setTheme } = useTheme();

  if (variant === "dropdown") {
    return (
      <div className={cn("flex items-center space-x-1 p-1 bg-muted rounded-lg", className)}>
        <Button
          variant={theme === "light" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTheme("light")}
          className="h-8 w-8 p-0"
          title="Light mode"
        >
          <Sun className="h-4 w-4" />
        </Button>
        <Button
          variant={theme === "dark" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTheme("dark")}
          className="h-8 w-8 p-0"
          title="Dark mode"
        >
          <Moon className="h-4 w-4" />
        </Button>
        <Button
          variant={theme === "system" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTheme("system")}
          className="h-8 w-8 p-0"
          title="System theme"
        >
          <Monitor className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Single button that cycles through themes
  const handleToggle = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getIcon = () => {
    if (theme === "system") {
      return <Monitor className="h-4 w-4" />;
    }
    return actualTheme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  };

  const getTitle = () => {
    if (theme === "system") {
      return `System theme (${actualTheme})`;
    }
    return theme === "dark" ? "Dark mode" : "Light mode";
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className={cn("h-9 w-9", className)}
      title={getTitle()}
    >
      {getIcon()}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
