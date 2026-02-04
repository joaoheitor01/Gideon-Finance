import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        try {
          // Check if profile already exists
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", session.user.id)
            .single();

          if (profileError && profileError.code !== "PGRST002") { // Ignore "no rows found"
            throw new Error(`Error checking profile: ${profileError.message}`);
          }

          // Create profile if it doesn't exist
          if (!profile) {
            const { error: insertError } = await supabase.from("profiles").insert({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || "Usuário",
              avatar_url: session.user.user_metadata?.avatar_url,
            });

            if (insertError) {
              throw new Error(`Error creating profile: ${insertError.message}`);
            }
          }
          
          // Redirect to dashboard
          navigate("/");

        } catch (error) {
          console.error("Error during auth callback:", error);
          toast({
            title: "Erro na autenticação",
            description: "Não foi possível completar o login. Por favor, tente novamente.",
            variant: "destructive",
          });
          navigate("/auth");
        }
      } else if (event === "SIGNED_OUT") {
        navigate("/auth");
      }
    });

    // Cleanup subscription on component unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Finalizando sua autenticação...</p>
        <p className="text-sm text-foreground mt-2">Aguarde um momento, estamos preparando tudo para você.</p>
      </div>
    </div>
  );
};

export default AuthCallback;