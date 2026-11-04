import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      roleId: string | null;
      roleName: string | null;
      permissions: Record<string, boolean>;
    };
  }
}
