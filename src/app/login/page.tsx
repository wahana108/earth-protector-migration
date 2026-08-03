import { Suspense } from "react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { LoginForm } from "@/components/auth-components";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  return (
    <AuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Logo />
            </div>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Sign in to continue to Earth Sanctuary</CardDescription>
        </CardHeader>
        <CardContent>
            <Suspense fallback={<div className="text-sm text-muted-foreground text-center py-8">Memuat...</div>}>
              <LoginForm />
            </Suspense>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
