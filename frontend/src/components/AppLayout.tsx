import { useState, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { AppTopBar } from "./AppTopBar";
import { AppSidebar } from "./AppSidebar";
import { CommandPalette } from "./CommandPalette";
import { HireflowAIAssistant } from "./HireflowAIAssistant";
import { MobileBottomNav } from "./MobileBottomNav";

export function AppLayout() {
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => localStorage.getItem("hireflow_sidebar_collapsed") === "1");
  const toggleMobileNav = useCallback(() => setMobileNav((v) => !v), []);
  const closeMobileNav = useCallback(() => setMobileNav(false), []);
  const toggleDesktopSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("hireflow_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }, []);

  return (
    <div className="page-shell min-h-screen bg-[var(--color-bg-primary)]">
      <AppTopBar
        onMenuToggle={toggleMobileNav}
        onSidebarToggle={toggleDesktopSidebar}
        sidebarCollapsed={sidebarCollapsed}
      />
      <CommandPalette />

      {/* Mobile sidebar overlay */}
      {mobileNav && (
        <>
          <div className="mobile-sidebar-overlay" onClick={closeMobileNav} />
          <div className="mobile-sidebar">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-text">Menu</span>
              <button type="button" onClick={closeMobileNav} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-raised hover:text-text" aria-label="Close menu">
                <svg width="16" height="16" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
              </button>
            </div>
            <AppSidebar mobile onNavigate={closeMobileNav} />
          </div>
        </>
      )}

      <div className="flex min-h-[calc(100vh-64px)] bg-[var(--color-bg-primary)]">
        <AppSidebar collapsed={sidebarCollapsed} />
        <main className="flex-1 bg-[var(--color-bg-primary)] px-4 py-6 pb-24 transition-all duration-300 ease-in-out lg:px-8 lg:pb-6">
          <div className="mx-auto max-w-[1100px] animate-page-enter">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileBottomNav />
      <HireflowAIAssistant />
    </div>
  );
}
