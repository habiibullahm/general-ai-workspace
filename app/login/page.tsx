import { getProductName } from "@/lib/config/branding";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return <AuthForm mode="sign-in" productName={getProductName()} />;
}
