'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/components/ui/button';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Smartphone, 
  Users, 
  Megaphone, 
  Settings 
} from 'lucide-react';

const navItems = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Unified Inbox', href: '/dashboard/inbox', icon: MessageSquare },
  { name: 'WhatsApp Accounts', href: '/dashboard/whatsapp', icon: Smartphone },
  { name: 'CRM', href: '/dashboard/crm', icon: Users },
  { name: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 p-4 space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group",
              isActive 
                ? "bg-blue-50 text-blue-700 shadow-sm" 
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon className={cn(
              "mr-3 h-5 w-5 transition-colors",
              isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-500"
            )} />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
