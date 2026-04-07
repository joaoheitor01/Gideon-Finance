import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from 'next-themes';
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut, TrendingUp } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isInvestmentsPage = location.pathname === "/investments";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">
            Gideon Finance
          </h1>
          
          <div className="flex items-center gap-2">

            <Button
              variant={isInvestmentsPage ? "default" : "ghost"}
              size="sm"
              onClick={() => navigate("/investments")}
              className="gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Investimentos</span>
            </Button>

            <Button
              variant={!isInvestmentsPage ? "default" : "outline"}
              size="sm"
              onClick={() => navigate("/")}
            >
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <span className="hidden text-sm text-muted-foreground sm:block">
              {user?.user_metadata?.full_name || user?.email}
            </span>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-9 w-9"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container py-6">
        {children}
      </main>
    </div>
  );
}
