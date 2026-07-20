import { logger } from "./logger";

export type AccentColor = "purple" | "blue" | "green" | "orange" | "pink" | "teal" | "amber";

interface ThemePreferences {
  accentColor: AccentColor;
  darkMode: boolean;
  fontSize: "small" | "medium" | "large";
  reducedMotion: boolean;
}

const THEME_STORAGE_KEY = "orbit_theme_preferences";

const ACCENT_COLORS: Record<AccentColor, string> = {
  purple: "#a855f7",
  blue: "#3b82f6",
  green: "#22c55e",
  orange: "#f97316",
  pink: "#ec4899",
  teal: "#14b8a6",
  amber: "#f59e0b",
};

const ACCENT_CSS_VARS: Record<AccentColor, Record<string, string>> = {
  purple: { "--accent": "#a855f7", "--accent-light": "#c084fc", "--accent-dark": "#7c3aed" },
  blue: { "--accent": "#3b82f6", "--accent-light": "#60a5fa", "--accent-dark": "#2563eb" },
  green: { "--accent": "#22c55e", "--accent-light": "#4ade80", "--accent-dark": "#16a34a" },
  orange: { "--accent": "#f97316", "--accent-light": "#fb923c", "--accent-dark": "#ea580c" },
  pink: { "--accent": "#ec4899", "--accent-light": "#f472b6", "--accent-dark": "#db2777" },
  teal: { "--accent": "#14b8a6", "--accent-light": "#2dd4bf", "--accent-dark": "#0d9488" },
  amber: { "--accent": "#f59e0b", "--accent-light": "#fbbf24", "--accent-dark": "#d97706" },
};

const DEFAULT_PREFERENCES: ThemePreferences = {
  accentColor: "purple",
  darkMode: true,
  fontSize: "medium",
  reducedMotion: false,
};

let currentPreferences: ThemePreferences = { ...DEFAULT_PREFERENCES };

/**
 * Load saved theme preferences from localStorage.
 */
export function loadThemePreferences(): ThemePreferences {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      currentPreferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
    }
  } catch (err) {
    logger.warn("Failed to load theme preferences", err);
  }
  return currentPreferences;
}

/**
 * Save theme preferences to localStorage and apply them.
 */
export function saveThemePreferences(prefs: Partial<ThemePreferences>): ThemePreferences {
  currentPreferences = { ...currentPreferences, ...prefs };
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(currentPreferences));
  } catch (err) {
    logger.warn("Failed to save theme preferences", err);
  }
  applyTheme(currentPreferences);
  return currentPreferences;
}

/**
 * Apply theme preferences to the document.
 */
export function applyTheme(prefs: ThemePreferences): void {
  const root = document.documentElement;

  // Apply accent colors
  const vars = ACCENT_CSS_VARS[prefs.accentColor] || ACCENT_CSS_VARS.purple;
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  // Apply font size
  const fontSizes = { small: "14px", medium: "16px", large: "18px" };
  root.style.setProperty("--font-size-base", fontSizes[prefs.fontSize]);

  // Apply reduced motion
  if (prefs.reducedMotion) {
    root.style.setProperty("--motion-reduce", "0");
  } else {
    root.style.setProperty("--motion-reduce", "1");
  }
}

/**
 * Get current theme preferences.
 */
export function getThemePreferences(): ThemePreferences {
  return { ...currentPreferences };
}

/**
 * Get all available accent colors.
 */
export function getAccentColors(): Record<AccentColor, string> {
  return { ...ACCENT_COLORS };
}

/**
 * Initialize theme on app load.
 */
export function initTheme(): void {
  loadThemePreferences();
  applyTheme(currentPreferences);
}
