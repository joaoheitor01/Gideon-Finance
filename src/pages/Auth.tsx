import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "A senha deve ter pelo menos 6 caracteres");

export default function Auth() {
  const { user, loading, signIn } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
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

    // Check for locked account
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_locked, failed_login_attempts, user_id")
      .eq("email", formData.email)
      .single();

    if (profile?.account_locked) {
      toast({
        title: "Conta bloqueada",
        description: "Sua conta foi bloqueada por excesso de tentativas. Por favor, recupere sua senha.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const { error } = await signIn(formData.email, formData.password);
    if (error) {
      if (error.message === "Invalid login credentials") {
        if (profile) {
          const newAttempts = (profile.failed_login_attempts || 0) + 1;
          let locked = profile.account_locked;
          if (newAttempts >= 5) {
            locked = true;
          }

          await supabase
            .from("profiles")
            .update({ failed_login_attempts: newAttempts, account_locked: locked })
            .eq("email", formData.email);

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
      // Reset attempts on successful login
      if (profile) {
        await supabase
          .from("profiles")
          .update({ failed_login_attempts: 0 })
          .eq("email", formData.email);
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

            <div>
              <Label htmlFor="password" className="text-foreground">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                className="mt-1.5 bg-secondary border-0 h-12"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 text-base font-semibold"
            >
              {isSubmitting ? "Carregando..." : "Acessar Conta"}
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
        </div>
      </div>
    </div>
  );
}

