import { getProductName } from "@/lib/config/branding";
import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <AuthForm mode="sign-in" oauthError={params.error === "oauth"} productName={getProductName()} />;
}
