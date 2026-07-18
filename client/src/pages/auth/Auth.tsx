import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getSocialLoginUrl } from "@/lib/api";
import { Field, FormInput } from "@/components/forms";
import {
  Rocket,
  Mail,
  Lock,
  User,
  Facebook,
  Linkedin,
  Instagram,
  ArrowLeft,
} from "lucide-react";
import Logo from "@/components/Logo";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { cn } from "@/lib/utils";

const primaryBtnClass =
  "w-full h-9 rounded-full text-sm font-medium bg-primary border-0 shadow-sm";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const SOCIAL_PROVIDERS = [
  {
    id: "google" as const,
    label: "Google",
    Icon: GoogleIcon,
    theme:
      "bg-slate-50 text-slate-900 border border-slate-300 hover:bg-slate-100 hover:text-slate-900 shadow-sm",
  },
  {
    id: "facebook" as const,
    label: "Facebook",
    Icon: Facebook,
    theme: "bg-[#1877F2] text-white border-0 hover:bg-[#166FE5] shadow-sm",
  },
  {
    id: "linkedin" as const,
    label: "LinkedIn",
    Icon: Linkedin,
    theme: "bg-[#0A66C2] text-white border-0 hover:bg-[#095196] shadow-sm",
  },
  {
    id: "instagram" as const,
    label: "Instagram",
    Icon: Instagram,
    theme:
      "bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737] text-white border-0 hover:opacity-90 shadow-sm",
  },
];

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { login, register, requestPasswordReset } = useAuth();

  useEffect(() => {
    if (searchParams.get("mode") === "signup") setIsSignUp(true);
    const invitedEmail = searchParams.get("email");
    if (invitedEmail) {
      setEmail(invitedEmail);
      setIsSignUp(true);
    }
  }, [searchParams]);

  const handleSocialLogin = (provider: "google" | "facebook" | "linkedin" | "instagram") => {
    window.location.href = getSocialLoginUrl(provider);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await register({
          email,
          password,
          firstName: fullName.split(" ")[0] || "",
          lastName: fullName.split(" ").slice(1).join(" ") || "",
        });
        toast({ title: "Success", description: "Account created!" });
      } else {
        await login(email, password);
        toast({ title: "Success", description: "Logged in successfully" });
      }
      navigate("/dashboard");
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Authentication failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset(email);
      toast({
        title: "Email sent",
        description: "Check your inbox for password reset instructions",
      });
      setIsForgotPassword(false);
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send reset link",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderSocialButtons = (variant: "mobile" | "desktop") => (
    <div
      className={cn(
        variant === "mobile" &&
        "flex flex-wrap items-center justify-center gap-3 lg:hidden",
        variant === "desktop" && "hidden lg:flex flex-col gap-2.5",
      )}
    >
      {SOCIAL_PROVIDERS.map(({ id, label, Icon, theme }) => (
        <Button
          key={`${variant}-${id}`}
          type="button"
          variant="outline"
          size={variant === "mobile" ? "icon" : "sm"}
          className={cn(
            theme,
            variant === "mobile" &&
            "h-11 w-11 min-w-11 rounded-full p-0 [&_svg]:size-5",
            variant === "desktop" &&
            "w-full h-9 rounded-full text-sm font-medium gap-2 justify-center",
          )}
          onClick={() => handleSocialLogin(id)}
          aria-label={`Continue with ${label}`}
        >
          <Icon className={cn("shrink-0", variant === "desktop" && "h-4 w-4")} />
          {variant === "desktop" && <span>{label}</span>}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-md lg:max-w-4xl min-w-0 flex flex-col gap-4 sm:gap-6">
        <AppBreadcrumbs />



        <Card className="w-full shadow-card border-border/50 rounded-2xl">
          <CardHeader className="pb-2 px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6">
            <div className="flex justify-center shrink-0">
              <Logo className="h-16 w-auto sm:h-24 lg:h-28" />
            </div>
            <CardTitle className="text-base sm:text-lg font-display text-center lg:text-left">
              {isForgotPassword
                ? "Reset Password"
                : isSignUp
                  ? "Create your account"
                  : "Welcome back"}
            </CardTitle>
          </CardHeader>

          <CardContent className="px-4 sm:px-6 lg:px-8 pb-5 sm:pb-6 lg:pb-8">
            {isForgotPassword ? (
              <div className="flex flex-col gap-4 max-w-md mx-auto lg:mx-0">
                <form onSubmit={handleForgotPassword} className="flex flex-col gap-3">
                  <Field
                    label="Email"
                    htmlFor="email"
                    hint="We'll send a reset link to this address."
                    required
                  >
                    <FormInput
                      id="email"
                      type="email"
                      icon={Mail}
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Field>
                  <Button type="submit" disabled={loading} className={primaryBtnClass}>
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-sm text-primary hover:underline flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
                {/* Left: email / password form */}
                <div className="flex flex-col gap-4 min-w-0">
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    {isSignUp && (
                      <Field label="Full name" htmlFor="name">
                        <FormInput
                          id="name"
                          icon={User}
                          placeholder="Your name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </Field>
                    )}
                    <Field label="Email" htmlFor="email" required>
                      <FormInput
                        id="email"
                        type="email"
                        icon={Mail}
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </Field>
                    <Field
                      label="Password"
                      htmlFor="password"
                      required
                      hint={isSignUp ? "At least 6 characters" : undefined}
                    >
                      <div className="flex flex-col gap-1">
                        {!isSignUp && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setIsForgotPassword(true)}
                              className="text-xs text-primary hover:underline"
                            >
                              Forgot password?
                            </button>
                          </div>
                        )}
                        <FormInput
                          id="password"
                          type="password"
                          icon={Lock}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                      </div>
                    </Field>
                    <Button type="submit" disabled={loading} className={primaryBtnClass}>
                      {loading ? (
                        "Loading..."
                      ) : isSignUp ? (
                        <>
                          <Rocket className="h-3.5 w-3.5" />
                          Create Account
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                  </form>

                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-xs sm:text-sm text-primary hover:underline text-center lg:text-left"
                  >
                    {isSignUp
                      ? "Already have an account? Sign in"
                      : "Don't have an account? Sign up"}
                  </button>
                </div>

                {/* Right: social sign-in */}
                <div className="flex flex-col gap-4 min-w-0 lg:border-l lg:border-border/60 lg:pl-8">
                  <div className="relative py-1 lg:py-0">
                    <div className="absolute inset-0 flex items-center lg:hidden">
                      <Separator className="w-full" />
                    </div>
                    <p className="relative text-center lg:text-left text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground bg-card lg:bg-transparent px-2 lg:px-0 mx-auto lg:mx-0 w-fit lg:w-full">
                      or continue with
                    </p>
                  </div>

                  {renderSocialButtons("mobile")}
                  {renderSocialButtons("desktop")}

                  <p className="hidden lg:block text-xs text-muted-foreground leading-relaxed">
                    Sign in with your social account. We only request the permissions needed to
                    connect your profiles.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
