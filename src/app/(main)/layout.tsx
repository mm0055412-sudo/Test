'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, config } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user || !config?.isLoggedIn) {
        router.replace('/welcome');
      }
    }
  }, [user, loading, config?.isLoggedIn, router]);

  if (loading || !user || !config?.isLoggedIn) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto max-w-2xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
