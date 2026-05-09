import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ensureActiveOrg } from "@/lib/org";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma as any),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }

      // Refresh activeOrgId from the DB on:
      //   - first login (token.id just set, no orgId yet)
      //   - explicit session refresh (trigger === "update", e.g. after the
      //     user clicked "Switch workspace")
      // Otherwise we trust the cached value and avoid a DB hit on every JWT
      // verification.
      const userId = token.id as string | undefined;
      if (userId && (!token.activeOrgId || trigger === "update")) {
        try {
          token.activeOrgId = await ensureActiveOrg(userId);
        } catch (e) {
          // Don't block sign-in on a workspace bootstrap failure — the user
          // can still see the auth-error UX and try again. Fall through with
          // no activeOrgId so the app can show a recovery state.
          console.error("[auth] ensureActiveOrg failed:", e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.activeOrgId =
          (token.activeOrgId as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});
