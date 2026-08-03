'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { UnverifiedEmailError, type AuthCredentials } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { MailCheck } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function hasSessionCookie(): boolean {
  return document.cookie.split('; ').some((c) => c.startsWith('__session='));
}

// Cookie __session ditulis oleh onAuthStateChanged (use-auth.tsx) di rantai
// promise TERPISAH dari sign-in ini — polling singkat menutup race antara
// navigasi dan penulisan cookie, alih-alih navigasi buta sebelum cookie
// benar-benar ada (lihat investigasi fix/login-reliability).
async function waitForSessionCookie(timeoutMs = 5000, intervalMs = 50): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (hasSessionCookie()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return hasSessionCookie();
}

// Navigasi full-page (bukan router.push) supaya cookie yang baru ditulis
// dijamin ikut terkirim di request yang dibaca middleware.
async function awaitSessionAndRedirect(target: string): Promise<boolean> {
  const ready = await waitForSessionCookie();
  if (!ready) return false;
  window.location.assign(target);
  return true;
}

function isSafeRedirectPath(path: string | null): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
}

const SESSION_TIMEOUT_MESSAGE = 'Gagal menyiapkan sesi. Periksa koneksi Anda lalu coba lagi.';

function ForgotPasswordDialog({ onClose }: { onClose: () => void }) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (!email.trim()) { setError('Email wajib diisi.'); return; }
    setLoading(true);
    setError('');
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim link reset. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Lupa Password</DialogTitle>
        </DialogHeader>
        {sent ? (
          <p className="text-sm text-muted-foreground py-1">
            Jika email terdaftar, link reset password telah dikirim. Cek inbox Anda.
          </p>
        ) : (
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Masukkan email akun Anda. Kami akan mengirim link untuk membuat password baru.
            </p>
            <Input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{sent ? 'Tutup' : 'Batal'}</Button>
          {!sent && (
            <Button onClick={handleSend} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Kirim Link Reset
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

const signUpSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export function LoginForm() {
  const searchParams = useSearchParams();
  const { signIn, signInWithGoogle, resendVerificationEmailFor } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [unverifiedCredentials, setUnverifiedCredentials] = useState<AuthCredentials | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [preparingSession, setPreparingSession] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const fromParam = searchParams.get('from');
  const redirectTarget = isSafeRedirectPath(fromParam) ? fromParam : '/explore';

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    setError(null);
    setUnverifiedCredentials(null);
    setResent(false);
    try {
      await signIn(values);
    } catch (err: any) {
      setIsLoading(false);
      if (err instanceof UnverifiedEmailError) {
        setError(err.message);
        setUnverifiedCredentials(values);
      } else {
        setError(err.message || 'An unexpected error occurred.');
      }
      return;
    }
    setPreparingSession(true);
    const ok = await awaitSessionAndRedirect(redirectTarget);
    if (!ok) {
      setError(SESSION_TIMEOUT_MESSAGE);
      setIsLoading(false);
      setPreparingSession(false);
    }
    // Sukses: state sengaja dibiarkan "loading" — halaman sedang navigasi pergi.
  };

  const handleResend = async () => {
    if (!unverifiedCredentials) return;
    setIsResending(true);
    try {
      await resendVerificationEmailFor(unverifiedCredentials);
      setResent(true);
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim ulang email verifikasi.');
    } finally {
      setIsResending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setIsGoogleLoading(false);
      setError(err.message || 'Failed to sign in with Google.');
      return;
    }
    setPreparingSession(true);
    const ok = await awaitSessionAndRedirect(redirectTarget);
    if (!ok) {
      setError(SESSION_TIMEOUT_MESSAGE);
      setIsGoogleLoading(false);
      setPreparingSession(false);
    }
    // Sukses: state sengaja dibiarkan "loading" — halaman sedang navigasi pergi.
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Login Failed</AlertTitle>
          <AlertDescription>
            {error}
            {unverifiedCredentials && (
              resent ? (
                <p className="mt-2 font-medium">Email verifikasi terkirim ulang. Cek inbox Anda.</p>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 mt-2 text-destructive underline"
                  onClick={handleResend}
                  disabled={isResending}
                >
                  {isResending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  Kirim ulang email verifikasi
                </Button>
              )
            )}
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || isLoading}
      >
        {isGoogleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        {isGoogleLoading && preparingSession ? 'Menyiapkan sesi...' : 'Sign in with Google'}
      </Button>

      <div className="flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="name@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading && preparingSession ? 'Menyiapkan sesi...' : 'Sign In with Email'}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm">
        <button
          type="button"
          className="underline text-muted-foreground hover:text-primary"
          onClick={() => setShowForgotPassword(true)}
        >
          Lupa password?
        </button>
      </p>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="underline hover:text-primary">
          Sign up
        </Link>
      </p>

      {showForgotPassword && (
        <ForgotPasswordDialog onClose={() => setShowForgotPassword(false)} />
      )}
    </div>
  );
}

export function SignUpForm() {
  const { signUp, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null);
  const [preparingSession, setPreparingSession] = useState(false);

  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: z.infer<typeof signUpSchema>) => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await signUp(values);
      setSignedUpEmail(user.email);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setIsGoogleLoading(false);
      setError(err.message || 'Failed to sign in with Google.');
      return;
    }
    setPreparingSession(true);
    const ok = await awaitSessionAndRedirect('/explore');
    if (!ok) {
      setError(SESSION_TIMEOUT_MESSAGE);
      setIsGoogleLoading(false);
      setPreparingSession(false);
    }
    // Sukses: state sengaja dibiarkan "loading" — halaman sedang navigasi pergi.
  };

  if (signedUpEmail) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-primary" />
        <p className="text-sm text-muted-foreground">
          Kami telah mengirim link verifikasi ke <span className="font-medium text-foreground">{signedUpEmail}</span>.
          Buka email tersebut, klik link verifikasi, lalu login kembali.
        </p>
        <Link href="/login" className="underline text-sm hover:text-primary">
          Kembali ke halaman login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Sign Up Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || isLoading}
      >
        {isGoogleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        {isGoogleLoading && preparingSession ? 'Menyiapkan sesi...' : 'Continue with Google'}
      </Button>

      <div className="flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="name@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="underline hover:text-primary">
          Sign in
        </Link>
      </p>
    </div>
  );
}
