import React from 'react';
import { MessageSquare } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-background text-foreground">
      {/* Top navbar */}
      <header className="p-4 sm:p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight">Wavedesk</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Main content centered */}
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 md:p-8">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground border-t">
        Wavedesk &copy; {new Date().getFullYear()} &mdash; WhatsApp Business API CRM Platform
      </footer>
    </div>
  );
}
