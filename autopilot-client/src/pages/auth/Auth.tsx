import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getSocialLoginUrl } from "@/lib/api";
import { Field, FormInput } from "@/components/forms";
import { Rocket, Mail, Lock, User, ArrowLeft, Facebook, Linkedin, Instagram } from "lucide-react";

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
      toast({ title: "Error", description: err instanceof Error ? err.message : "Authentication failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset(email);
      toast({ title: "Email sent", description: "Check your inbox for password reset instructions" });
      setIsForgotPassword(false);
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to send reset link", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <Link to="/home" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit">
          <ArrowLeft className="h-3 w-3" /> Back to home
        </Link>

        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-glow">
            <Rocket className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-display">BrandPilot</h1>
          <p className="text-sm text-muted-foreground">AI Marketing Autopilot for Growing Brands</p>
        </div>

        <Card className="shadow-card border-border/50 rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-display">
              {isForgotPassword ? "Reset Password" : isSignUp ? "Create your account" : "Welcome back"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isForgotPassword ? (
              <>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <Field label="Email" htmlFor="email" hint="We'll send a reset link to this address." required>
                    <FormInput id="email" type="email" icon={Mail} placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </Field>
                  <Button type="submit" disabled={loading} className="w-full h-11 rounded-lg gradient-primary">{loading ? "Sending..." : "Send Reset Link"}</Button>
                </form>
                <button type="button" onClick={() => setIsForgotPassword(false)} className="text-sm text-primary hover:underline flex items-center gap-1 mx-auto">
                  <ArrowLeft className="h-3 w-3" /> Back to Sign In
                </button>
              </>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {isSignUp && (
                    <Field label="Full name" htmlFor="name">
                      <FormInput id="name" icon={User} placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </Field>
                  )}
                  <Field label="Email" htmlFor="email" required>
                    <FormInput id="email" type="email" icon={Mail} placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </Field>
                  <Field
                    label="Password"
                    htmlFor="password"
                    required
                    hint={isSignUp ? "At least 6 characters" : undefined}
                  >
                    <div className="space-y-1">
                      {!isSignUp && (
                        <div className="flex justify-end -mt-1 mb-1">
                          <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs text-primary hover:underline">
                            Forgot password?
                          </button>
                        </div>
                      )}
                      <FormInput id="password" type="password" icon={Lock} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                    </div>
                  </Field>
                  <Button type="submit" disabled={loading} className="w-full h-11 rounded-lg gradient-primary">
                    {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
                  </Button>
                </form>

                <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-primary hover:underline w-full text-center">
                  {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                </button>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center"><Separator className="w-full" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or continue with</span></div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="h-10 rounded-lg" onClick={() => handleSocialLogin("google")}>Google</Button>
                  <Button variant="outline" className="h-10 rounded-lg" onClick={() => handleSocialLogin("facebook")}><Facebook className="mr-1.5 h-4 w-4" /> Facebook</Button>
                  <Button variant="outline" className="h-10 rounded-lg" onClick={() => handleSocialLogin("linkedin")}><Linkedin className="mr-1.5 h-4 w-4" /> LinkedIn</Button>
                  <Button variant="outline" className="h-10 rounded-lg" onClick={() => handleSocialLogin("instagram")}><Instagram className="mr-1.5 h-4 w-4" /> Instagram</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
