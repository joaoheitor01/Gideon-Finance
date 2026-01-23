import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import { SignUp } from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Cria o cliente do React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutos
    },
  },
});

const App = () => (
  // BrowserRouter APENAS AQUI (não no main.tsx)
  <BrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            {/* Sistema de rotas */}
            <Routes>
              {/* Rotas públicas */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Rota protegida (dashboard principal) */}
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              
              {/* Rota 404 - Página não encontrada */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;