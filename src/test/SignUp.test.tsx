import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { SignUp } from "@/pages/SignUp";
import { AuthProvider } from "@/contexts/AuthContext";
import { vi } from "vitest";
import { act } from "react-dom/test-utils";

// Mock ResizeObserver
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: [{}], error: null }),
    })),
  },
}));

// Mock window.location.origin
Object.defineProperty(window, "location", {
  value: {
    origin: "http://localhost:3000",
  },
  writable: true,
});

describe("SignUp", () => {
  it("should render the sign up form correctly", async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <SignUp />
          </AuthProvider>
        </BrowserRouter>
      );
    });

    expect(await screen.findByPlaceholderText("Seu nome completo")).toBeInTheDocument();
    expect(await screen.findByPlaceholderText("seu@email.com")).toBeInTheDocument();
    expect(await screen.findAllByPlaceholderText("••••••••")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Criar Conta/i })).toBeInTheDocument();
  });

  it("should show an error message if the name is too short", async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <SignUp />
          </AuthProvider>
        </BrowserRouter>
      );
    });

    fireEvent.change(await screen.findByPlaceholderText("Seu nome completo"), {
      target: { value: "a" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Criar Conta/i }));

    await waitFor(() => {
      expect(screen.getByText("Nome deve ter pelo menos 3 caracteres")).toBeInTheDocument();
    });
  });

  it("should show an error message if the email is invalid", async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <SignUp />
        </AuthProvider>
      </BrowserRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
      target: { value: "invalid-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Criar Conta/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email inválido");
  });

  it("should show an error message if the password is too short", async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <SignUp />
          </AuthProvider>
        </BrowserRouter>
      );
    });

    const passwordInputs = await screen.findAllByPlaceholderText("••••••••");
    fireEvent.change(passwordInputs[0], {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Criar Conta/i }));

    await waitFor(() => {
      expect(screen.getByText("Senha deve ter pelo menos 8 caracteres")).toBeInTheDocument();
    });
  });

  it("should show an error message if the passwords do not match", async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <SignUp />
          </AuthProvider>
        </BrowserRouter>
      );
    });

    const passwordInputs = await screen.findAllByPlaceholderText("••••••••");
    fireEvent.change(passwordInputs[0], {
      target: { value: "password123" },
    });
    fireEvent.change(passwordInputs[1], {
      target: { value: "password456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Criar Conta/i }));

    await waitFor(() => {
      expect(screen.getByText("Senhas não coincidem")).toBeInTheDocument();
    });
  });

  it("should submit the form with all data including account type", async () => {
    const { supabase } = await import("@/integrations/supabase/client");

    await act(async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <SignUp />
          </AuthProvider>
        </BrowserRouter>
      );
    });

    fireEvent.change(await screen.findByPlaceholderText("Seu nome completo"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(await screen.findByPlaceholderText("seu@email.com"), {
      target: { value: "john.doe@example.com" },
    });
    const passwordInputs = await screen.findAllByPlaceholderText("••••••••");
    fireEvent.change(passwordInputs[0], {
      target: { value: "Password123" },
    });
    fireEvent.change(passwordInputs[1], {
      target: { value: "Password123" },
    });
     fireEvent.change(await screen.findByLabelText(/Data de Nascimento/i), {
      target: { value: "1990-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Criar Conta/i }));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: "john.doe@example.com",
        password: "Password123",
        options: {
          data: {
            full_name: "John Doe",
            birth_date: "1990-01-01",
            gender: "prefer_not_to_say",
            account_type: "Pessoal",
          },
          emailRedirectTo: "http://localhost:3000/auth",
        },
      });
    });
  });
});