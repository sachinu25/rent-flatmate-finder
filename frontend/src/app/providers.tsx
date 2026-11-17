"use client";

import { Toaster } from "sonner";

import { AuthProvider } from "@/contexts/auth-context";
import { RealtimeProvider } from "@/contexts/realtime-context";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";

function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      position="top-center"
      theme={resolved}
      closeButton
      toastOptions={{ classNames: { toast: "!rounded-2xl !border-border !shadow-lift !font-sans" } }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RealtimeProvider>
          {children}
          <ThemedToaster />
        </RealtimeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
