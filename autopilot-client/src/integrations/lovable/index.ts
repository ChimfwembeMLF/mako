import { getSocialLoginUrl } from "@/lib/api";

type SignInOptions = {
  redirect_uri?: string;
};

const isDev = import.meta.env.MODE === "development";

export const lovable = {
  auth: {
    signInWithGoogle: async (_opts?: SignInOptions) => {
      if (isDev) {
        return { user: { id: "dev-user", email: "dev@local" }, session: null, error: null };
      }
      window.location.href = getSocialLoginUrl("google");
      return { user: null, session: null, error: null };
    },
    signOut: async () => {
      return { error: null };
    },
  },
};
