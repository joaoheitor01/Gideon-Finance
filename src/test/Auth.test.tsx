import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Auth from "@/pages/Auth";
import { vi } from "vitest";
import { act } from "react-dom/test-utils";

vi.mock("@/integrations/supabase/client", () => {
  const mockSignInWithOAuth = vi.fn().mockResolvedValue({ error: null });
  const mockOnAuthStateChange = vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  const mockGetSession = vi
    .fn()
    .mockResolvedValue({ data: { session: null } });
  return {
    supabase: {
      auth: {
        signInWithOAuth: mockSignInWithOAuth,
        onAuthStateChange: mockOnAuthStateChange,
        getSession: mockGetSession,
      },
    },
  };
});

describe("Auth", () => {
  it("should call handleGoogleLogin when Google button is clicked", async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <Auth />
          </AuthProvider>
        </BrowserRouter>
      );
    });

    const googleButton = await screen.findByRole("button", { name: /google/i });
    fireEvent.click(googleButton);

    const { supabase } = await import("@/integrations/supabase/client");
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  });
});
