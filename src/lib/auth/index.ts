import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.betterAuthUsers,
      session: schema.betterAuthSessions,
      account: schema.betterAuthAccounts,
      verification: schema.betterAuthVerifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      // TODO: brancher Customer.io
      console.log(`Reset password for ${user.email}: ${url}`);
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // TODO: brancher Customer.io
      console.log(`Verify email for ${user.email}: ${url}`);
    },
  },

  plugins: [
    twoFactor({
      issuer: "TIMELESS",
    }),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 jours
    updateAge: 60 * 60 * 24,       // Renouvellement toutes les 24h
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache 5 minutes
    },
  },

  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
