import { listen } from "@tauri-apps/api/event";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect } from "react";
import { AppSettingsApi } from "@/lib/appSettings";

type ThemeMode = "light" | "dark" | "system";
type AppSettingUpdatedEvent = {
  key: string;
  value: string;
};

function normalizeTheme(value: string): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

function ThemeSync() {
  const { setTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;

    void AppSettingsApi.getAll()
      .then((settings) => {
        if (cancelled) return;
        setTheme(normalizeTheme(settings.theme));
      })
      .catch((error) => {
        console.error("Failed to sync theme from app settings:", error);
      });

    const unlisten = listen<AppSettingUpdatedEvent>(
      "app-settings-updated",
      (event) => {
        if (event.payload.key !== "theme") return;
        setTheme(normalizeTheme(event.payload.value));
      },
    );

    return () => {
      cancelled = true;
      void unlisten.then((fn) => fn()).catch(() => {});
    };
  }, [setTheme]);

  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ThemeSync />
      {children}
    </NextThemesProvider>
  );
}
