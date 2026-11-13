'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Search, LogOut, Building2, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ThemeToggle } from '@/components/theme-toggle';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

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

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
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
      // Ignore error during logout
    } finally {
      router.push('/auth/login');
      router.refresh();
    }
  };

  return (
    <header className="h-16 border-b bg-card text-card-foreground px-4 md:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Left: Mobile menu toggle + Global search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-accent"
            aria-label="Open navigation menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}

        <div className="relative w-full max-w-sm hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search conversations, contacts..."
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-muted/50 rounded-lg border border-transparent focus:border-border focus:bg-background outline-none transition-all placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Right: Company pill, Theme toggle, User profile & Logout */}
      <div className="flex items-center gap-3">
        {data?.company && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-muted/60 rounded-full text-xs font-medium text-foreground">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{data.company.name}</span>
          </div>
        )}

        <ThemeToggle />

        <div className="h-4 w-[1px] bg-border mx-1" />

        <div className="flex items-center gap-3">
          <Avatar name={data?.user?.name || 'User'} size="sm" />
          <div className="hidden sm:block text-left text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <span>{data?.user?.name || 'Loading...'}</span>
              {data?.user?.role && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                  {data.user.role}
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground truncate max-w-[140px]">
              {data?.user?.email}
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Log out"
            className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
