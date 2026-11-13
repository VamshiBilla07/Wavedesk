'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { SocketProvider } from '@/components/socket-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <SocketProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Mobile Drawer */}
        <MobileNav
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        {/* Content Area */}
        <div className="flex flex-col flex-1 min-w-0">
          <Topbar onMenuClick={() => setMobileNavOpen(true)} />
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SocketProvider>
  );
}
