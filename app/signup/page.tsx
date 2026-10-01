import { getProductName } from "@/lib/config/branding";
import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return <AuthForm mode="sign-up" productName={getProductName()} />;
}
