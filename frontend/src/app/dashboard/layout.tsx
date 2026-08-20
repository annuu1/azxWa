import { SidebarNav } from '@/shared/components/sidebar-nav';
import { Button } from '@/shared/components/ui/button';
import { logout } from '@/features/auth/actions/auth-actions';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col shadow-sm z-10 shrink-0">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">compuX</h2>
          </div>
        </div>
        
        <SidebarNav />

        <div className="p-4 border-t bg-gray-50/50">
          <form action={logout}>
            <Button type="submit" variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors">
              Logout
            </Button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-gray-50">
        {children}
      </main>
    </div>
  );
}
