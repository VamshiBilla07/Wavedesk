'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { GoogleButton } from '@/components/auth/google-button';

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post<{ token?: string }>('/auth/login', { email, password });
      if (res && res.token) {
        document.cookie = `wavedesk_token=${res.token}; path=/; max-age=604800; SameSite=Lax; secure`;
        localStorage.setItem('wavedesk_token', res.token);
      }
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to sign in. Please check your network and credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight">
          Welcome back
        </CardTitle>
        <CardDescription>
          Sign in to access your company WhatsApp dashboard
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20 font-medium">
              {error}
            </div>
          )}

          <GoogleButton mode="login" onError={(err) => setError(err)} />

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" required>
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" required>
                Password
              </Label>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Sign in
          </Button>


          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have a company account yet?{' '}
            <Link
              href="/auth/signup"
              className="text-primary hover:underline font-semibold"
            >
              Sign up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
