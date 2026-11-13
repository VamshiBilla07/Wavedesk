'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { SocketProvider } from '@/components/socket-provider';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const isInbox = pathname?.startsWith('/dashboard/inbox');

  return (
    <SocketProvider>
      <div className="flex min-h-screen bg-background text-foreground overflow-x-hidden">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Mobile Drawer */}
        <MobileNav
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        {/* Content Area */}
        <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
          <Topbar onMenuClick={() => setMobileNavOpen(true)} />
          <main
            className={cn(
              'flex-1 overflow-y-auto min-w-0',
              isInbox ? 'p-0 md:p-5 lg:p-6' : 'p-3 sm:p-4 md:p-6 lg:p-8'
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </SocketProvider>
  );
}

