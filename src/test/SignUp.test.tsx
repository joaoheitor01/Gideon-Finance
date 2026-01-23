import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignUp } from "../pages/SignUp";
import { BrowserRouter } from "react-router-dom";
import { vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/toaster";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
    },
  },
}));

describe("SignUp", () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should render the sign up form correctly", () => {
    render(
      <BrowserRouter>
        <SignUp />
      </BrowserRouter>
    );

    expect(screen.getByText("Criar Conta")).toBeInTheDocument();
    expect(screen.getByText("Preencha seus dados para começar a gerenciar suas finanças")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome Completo *")).toBeInTheDocument();
    expect(screen.getByLabelText("Email *")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de Uso *")).toBeInTheDocument();
    expect(screen.getByLabelText("Data de Nascimento *")).toBeInTheDocument();
    expect(screen.getByLabelText("Gênero")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha *")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar Senha *")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Criar Conta" })).toBeInTheDocument();
    expect(screen.getByText("Já tem conta?")).toBeInTheDocument();
  });

  it("should show an error message if the name is too short", async () => {
    render(
      <BrowserRouter>
        <SignUp />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText("Nome Completo *"), {
      target: { value: "a" },
    });
    fireEvent.blur(screen.getByLabelText("Nome Completo *"));

    expect(await screen.findByText("Nome deve ter pelo menos 3 caracteres")).toBeInTheDocument();
  });

  it("should show an error message if the email is invalid", async () => {
    render(
      <BrowserRouter>
        <SignUp />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText("Email *"), {
      target: { value: "invalid-email" },
    });
    fireEvent.blur(screen.getByLabelText("Email *"));

    expect(await screen.findByText("Email inválido")).toBeInTheDocument();
  });
  
  it("should show an error message if the password is too short", async () => {
    render(
      <BrowserRouter>
        <SignUp />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText("Senha *"), {
      target: { value: "123" },
    });
    fireEvent.blur(screen.getByLabelText("Senha *"));

    expect(await screen.findByText("Senha deve ter pelo menos 8 caracteres")).toBeInTheDocument();
  });

  it("should show an error message if the passwords do not match", async () => {
    render(
      <BrowserRouter>
        <SignUp />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText("Senha *"), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar Senha *"), {
      target: { value: "Password1234" },
    });
    fireEvent.blur(screen.getByLabelText("Confirmar Senha *"));

    expect(await screen.findByText("Senhas não coincidem")).toBeInTheDocument();
  });

  it("should submit the form with all data including account type", async () => {
    (supabase.auth.signUp as vi.Mock).mockResolvedValue({
      data: { user: { id: '123' } },
      error: null,
    });

    render(
      <BrowserRouter>
        <Toaster />
        <SignUp />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText("Nome Completo *"), { target: { value: "John Doe" } });
    fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "john.doe@example.com" } });
    fireEvent.change(screen.getByLabelText("Data de Nascimento *"), { target: { value: "1990-01-01" } });
    fireEvent.click(screen.getByLabelText("Empresarial")); // Select business account type
    fireEvent.change(screen.getByLabelText("Senha *"), { target: { value: "Password123" } });
    fireEvent.change(screen.getByLabelText("Confirmar Senha *"), { target: { value: "Password123" } });
    
    fireEvent.click(screen.getByRole('button', { name: "Criar Conta" }));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: "john.doe@example.com",
        password: "Password123",
        options: {
          data: {
            full_name: "John Doe",
            birth_date: "1990-01-01",
            gender: "prefer_not_to_say",
            account_type: "Empresarial", // Expecting this value
          },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });
    });

    // Check for success toast
    expect(await screen.findByText("🎉 Cadastro realizado com sucesso!")).toBeInTheDocument();
  });
});
