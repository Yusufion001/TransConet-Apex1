import { create } from "zustand";
import {
  getCurrentUser,
  login,
  logout,
  register,
  verifyEmail,
  verifyPhoneVerificationOtp,
  type LoginInput,
  type RegisterInput,
} from "../api/auth";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "../storage/auth-storage";
import type {
  AuthSession,
  AuthUser,
  RegistrationResult,
} from "./auth.types";

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  loading: boolean;

  hydrate: () => Promise<void>;
  signIn: (input: LoginInput) => Promise<AuthSession>;
  signUp: (input: RegisterInput) => Promise<RegistrationResult>;
  verifyEmail: (token: string) => Promise<AuthSession>;
  verifyPhoneOtp: (
    phoneVerificationToken: string,
    pin: string,
  ) => Promise<AuthSession>;
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

      if (!accessToken) {
        set({
          user: null,
          accessToken: null,
          refreshToken,
        });
        return;
      }

      set({
        accessToken,
        refreshToken,
        loading: true,
      });

      try {
        const user = await getCurrentUser();

        set({
          user,
          accessToken,
          refreshToken,
        });
      } catch {
        /*
         * The access token may be expired.
         *
         * The API client's refresh interceptor will attempt
         * to refresh it when /auth/me returns 401.
         *
         * If authentication still cannot be restored, clear
         * the local session.
         */
        const refreshedAccessToken =
          await getAccessToken();

        const refreshedRefreshToken =
          await getRefreshToken();

        if (!refreshedAccessToken) {
          await clearTokens();

          set({
            user: null,
            accessToken: null,
            refreshToken: null,
          });
          return;
        }

        try {
          const user = await getCurrentUser();

          set({
            user,
            accessToken: refreshedAccessToken,
            refreshToken: refreshedRefreshToken,
          });
        } catch {
          await clearTokens();

          set({
            user: null,
            accessToken: null,
            refreshToken: null,
          });
        }
      }
    } finally {
      set({
        hydrated: true,
        loading: false,
      });
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
      const result = await register(input);

      /*
       * Registration does NOT authenticate the user.
       *
       * The backend creates new accounts as PENDING.
       * Email accounts must complete verification before
       * an authenticated session is issued.
       */
      await clearTokens();

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
      });

      return result;
    } finally {
      set({ loading: false });
    }
  },

  verifyEmail: async (token) => {
    set({ loading: true });

    try {
      const session = await verifyEmail(token);

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

  verifyPhoneOtp: async (phoneVerificationToken, pin) => {
    set({ loading: true });

    try {
      const session = await verifyPhoneVerificationOtp(
        phoneVerificationToken,
        pin,
      );

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
        // Local authentication state must still be cleared.
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
