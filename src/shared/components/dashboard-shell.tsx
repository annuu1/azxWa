'use client';

import { useState } from 'react';
import { SidebarNav } from '@/shared/components/sidebar-nav';
import { Button } from '@/shared/components/ui/button';
import { Menu, X, LogOut } from 'lucide-react';
import { logout } from '@/features/auth/actions/auth-actions';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden flex-col md:flex-row">
      {/* Mobile Top Navigation Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 z-30 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open mobile menu"
            className="text-gray-700 hover:bg-gray-100 h-9 w-9"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shadow-xs">
              <span className="text-white font-bold text-base">C</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">compuX</h2>
          </div>
        </div>
      </header>

      {/* Mobile Backdrop & Drawer Sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer Content */}
          <aside className="relative w-72 max-w-[80vw] bg-white flex flex-col h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-xs">
                  <span className="text-white font-bold text-lg">C</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">compuX</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                className="h-8 w-8 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <SidebarNav onNavigate={() => setMobileOpen(false)} />

            <div className="p-4 border-t bg-gray-50/50">
              <form action={logout}>
                <Button 
                  type="submit" 
                  variant="ghost" 
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 font-medium py-2.5"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </form>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r flex-col shadow-xs z-10 shrink-0">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-xs">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">compuX</h2>
          </div>
        </div>

        <SidebarNav />

        <div className="p-4 border-t bg-gray-50/50">
          <form action={logout}>
            <Button 
              type="submit" 
              variant="ghost" 
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 font-medium transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </form>
        </div>
      </aside>

      {/* Main App Content Viewport */}
      <main className="flex-1 overflow-y-auto relative bg-gray-50 w-full">
        {children}
      </main>
    </div>
  );
}
