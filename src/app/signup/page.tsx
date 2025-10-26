import { AuthLayout } from "@/components/layout/auth-layout";
import { SignUpForm } from "@/components/auth-components";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default function SignUpPage() {
  return (
    <AuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Logo />
            </div>
            <CardTitle>Create an Account</CardTitle>
            <CardDescription>Join our community and start making an impact</CardDescription>
        </CardHeader>
        <CardContent>
            <SignUpForm />
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
