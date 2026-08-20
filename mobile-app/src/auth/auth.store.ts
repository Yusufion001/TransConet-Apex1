import { create } from "zustand";
import {
  login,
  logout,
  register,
  type LoginInput,
  type RegisterInput,
} from "../api/auth";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "../storage/auth-storage";
import type { AuthSession, AuthUser } from "./auth.types";

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  loading: boolean;

  hydrate: () => Promise<void>;
  signIn: (input: LoginInput) => Promise<AuthSession>;
  signUp: (input: RegisterInput) => Promise<AuthSession>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  loading: false,

  hydrate: async () => {
    try {
      const [accessToken, refreshToken] =
        await Promise.all([
          getAccessToken(),
          getRefreshToken(),
        ]);

      set({
        accessToken,
        refreshToken,
      });
    } finally {
      set({ hydrated: true });
    }
  },

  signIn: async (input) => {
    set({ loading: true });

    try {
      const session = await login(input);

      await saveTokens(
        session.accessToken,
        session.refreshToken,
      );

      set({
        user: session.user,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? null,
      });

      return session;
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (input) => {
    set({ loading: true });

    try {
      const session = await register(input);

      await saveTokens(
        session.accessToken,
        session.refreshToken,
      );

      set({
        user: session.user,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? null,
      });

      return session;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true });

    try {
      try {
        await logout();
      } catch {
        // The local session must still be cleared if the
        // network request fails.
      }
    } finally {
      await clearTokens();

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        loading: false,
      });
    }
  },
}));
