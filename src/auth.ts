import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { logAudit } from "@/lib/audit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email) },
          include: { role: true },
        });
        if (!user || !user.password || !user.active) return null;
        const valid = await bcrypt.compare(String(credentials.password), user.password);
        if (!valid) return null;
        return { id: user.id, name: user.name, email: user.email, roleId: user.roleId };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      await logAudit({
        userId: user.id,
        userEmail: user.email ?? undefined,
        action: "LOGIN",
        detail: "User signed in",
      });
    },
    async signOut({ token }) {
      await logAudit({
        userId: token?.sub,
        userEmail: token?.email ?? undefined,
        action: "LOGOUT",
        detail: "User signed out",
      });
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // fetch role+permissions fresh on sign-in
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { roleId: true, role: { select: { name: true, permissions: true } } },
        });
        token.roleId = dbUser?.roleId ?? null;
        token.roleName = dbUser?.role?.name ?? null;
        token.permissions = (dbUser?.role?.permissions ?? {}) as Record<string, boolean>;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.roleId = token.roleId as string | null;
      session.user.roleName = token.roleName as string | null;
      session.user.permissions = token.permissions as Record<string, boolean>;
      return session;
    },
  },
});
