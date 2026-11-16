export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { scheduleDailySnapshots } = await import("@/lib/dailySnapshot");
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
    scheduleDailySnapshots(baseUrl);
  }
}
