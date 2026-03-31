'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JellyfishIcon } from '@/components/jellyfish-icon';
import { Suspense } from 'react';

function LoginForm() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const handleGitHubLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl font-bold">
            <JellyfishIcon size={28} />
            NeuraMeter
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in to continue
          </p>
        </CardHeader>
        <CardContent>
          {error === 'not_invited' && (
            <div className="mb-4 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-center text-sm text-yellow-600 dark:text-yellow-400">
              You&apos;re on the waitlist. We&apos;ll notify you when access is ready.
            </div>
          )}
          {error === 'auth_failed' && (
            <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-600 dark:text-red-400">
              Authentication failed. Please try again.
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGitHubLogin}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Continue with GitHub
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have access?{' '}
            <Link
              href="/"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Join the waitlist
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
