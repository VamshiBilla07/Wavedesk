'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { X, MessageSquare, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { navItems } from './sidebar';

interface AuthMeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    companyId: string;
  };
  company: {
    id: string;
    name: string;
  };
}

export function MobileNav({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const { data } = useQuery<AuthMeResponse>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<AuthMeResponse>('/auth/me'),
    staleTime: 5 * 60 * 1000,
  });

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore
    } finally {
      if (typeof window !== 'undefined') {
        document.cookie = 'wavedesk_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; secure';
        localStorage.removeItem('wavedesk_token');
      }
      onClose();
      router.push('/auth/login');
      router.refresh();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative flex flex-col w-72 max-w-[85%] bg-card text-card-foreground p-4 shadow-2xl z-10 h-full border-r animate-in slide-in-from-left duration-200">
        <div className="flex items-center justify-between pb-3 mb-2 border-b">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm block leading-none">Wavedesk</span>
              <span className="text-[10px] text-muted-foreground">{data?.company?.name || 'WhatsApp CRM'}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="space-y-1 overflow-y-auto flex-1 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Drawer Footer with User & Logout */}
        <div className="pt-3 border-t mt-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={data?.user?.name || 'User'} size="sm" />
            <div className="text-xs min-w-0">
              <div className="font-semibold text-foreground truncate max-w-[120px]">
                {data?.user?.name || 'User'}
              </div>
              <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                {data?.user?.email}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileNav;
