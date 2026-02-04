import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "A senha deve ter pelo menos 6 caracteres");

export default function Auth() {
  const { user, loading, signIn } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        console.error("Error during Google login:", error.message);
        toast({
          title: "Erro ao entrar com Google",
          description: "Não foi possível autenticar com o Google. Por favor, tente novamente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("An unexpected error occurred during Google login:", error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado. Por favor, tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      emailSchema.parse(formData.email);
      passwordSchema.parse(formData.password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Dados inválidos",
          description: error.errors[0].message,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
    }

    const { error } = await signIn(formData.email, formData.password);
    if (error) {
      if (error.message === "Invalid login credentials") {
        // Find user by email to get their ID
        const { data: user, error: userError } = await supabase
          .from("users")
          .select("id")
          .eq("email", formData.email)
          .single();

        if (user) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("account_locked, failed_login_attempts")
            .eq("user_id", user.id)
            .single();
            
          if (profile) {
            const newAttempts = (profile.failed_login_attempts || 0) + 1;
            let locked = profile.account_locked;
            if (newAttempts >= 5) {
              locked = true;
            }

            await supabase
              .from("profiles")
              .update({ failed_login_attempts: newAttempts, account_locked: locked })
              .eq("user_id", user.id);

            if (locked) {
              toast({
                title: "Conta bloqueada",
                description: "Sua conta foi bloqueada por excesso de tentativas. Por favor, recupere sua senha.",
                variant: "destructive",
              });
            } else {
              toast({
                title: "Erro ao entrar",
                description: `Email ou senha incorretos. Você tem mais ${5 - newAttempts} tentativas.`,
                variant: "destructive",
              });
            }
          }
        } else {
          toast({
            title: "Erro ao entrar",
            description: "Email ou senha incorretos",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Erro ao entrar",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      // On successful login, find the user to reset their attempts
      const { data: user, error: userError } = await supabase.auth.getUser();

      if (user?.user) {
        await supabase
          .from("profiles")
          .update({ failed_login_attempts: 0, account_locked: false })
          .eq("user_id", user.user.id);
      }
    }

    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">
              Entrar na Gideon Finance
            </h1>
            <p className="mt-2 text-muted-foreground">
              Bem-vindo de volta
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                className="mt-1.5 bg-secondary border-0 h-12"
                required
              />
            </div>

            <div className="relative">
              <Label htmlFor="password" className="text-foreground">
                Senha
              </Label>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                className="mt-1.5 bg-secondary border-0 h-12 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-muted-foreground"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 text-base font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aguarde...
                </>
              ) : (
                "Acessar Conta"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              Ainda não tem conta?{" "}
              <Link
                to="/signup"
                className="text-primary hover:underline font-medium"
              >
                Criar Conta
              </Link>
            </p>
            <p className="text-muted-foreground mt-2">
              Esqueceu sua senha?{" "}
              <Link
                to="/forgot-password"
                className="text-primary hover:underline font-medium"
              >
                Recuperar Senha
              </Link>
            </p>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Ou continue com
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={handleGoogleLogin}
          >
            <svg
              className="mr-2 h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.19,4.73C14.03,4.73 15.1,5.5 15.71,6.15L17.84,4.12C16.15,2.44 14.19,2 12.19,2C6.92,2 2,6.58 2,12C2,17.42 6.92,22 12.19,22C17.6,22 21.7,18.35 21.7,12.33C21.7,11.75 21.56,11.4 21.35,11.1Z"
              />
            </svg>
            Google
          </Button>
        </div>
      </div>
    </div>
  );
}

