'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
      });
    }

    // Capture beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl bg-card border shadow-2xl p-4 flex items-start gap-3.5 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Smartphone className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
          Install Wavedesk App
        </h4>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
          Add Wavedesk to your home screen or desktop for fast, distraction-free messaging.
        </p>

        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" className="h-7 text-xs px-2.5" onClick={handleInstallClick}>
            <Download className="w-3.5 h-3.5 mr-1" />
            Install
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground text-xs p-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default PWAPrompt;
