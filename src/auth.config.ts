import type { NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

// Lightweight config used by middleware (Edge-compatible, no Prisma/Node imports)
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      tenantId: process.env.MICROSOFT_TENANT_ID ?? "",
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublic = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/api/auth");
      if (isPublic) return true;
      return isLoggedIn;
    },
  },
};
