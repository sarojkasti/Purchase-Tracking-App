// Sends mail via Microsoft Graph API.
// Credentials are read from AppSetting rows in the DB (set via Settings → Email Configuration).
// Falls back to env vars so the app still works before the UI is configured.

import { prisma } from "@/lib/prisma";

async function getSetting(key: string, envFallback: string): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value || process.env[envFallback] || "";
}

async function getAccessToken(): Promise<string> {
  const [tenantId, clientId, clientSecret] = await Promise.all([
    getSetting("mail_tenant_id", "MICROSOFT_TENANT_ID"),
    getSetting("mail_client_id", "MICROSOFT_CLIENT_ID"),
    getSetting("mail_client_secret", "MICROSOFT_CLIENT_SECRET"),
  ]);

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Email is not configured. An administrator must set up email settings.");
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );
  if (!res.ok) throw new Error(`Graph token error: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const sender = await getSetting("mail_sender", "GRAPH_MAIL_SENDER");
  if (!sender) throw new Error("Sender email is not configured.");

  const token = await getAccessToken();

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: false,
      }),
    }
  );
  if (!res.ok && res.status !== 202) {
    throw new Error(`Graph sendMail error ${res.status}: ${await res.text()}`);
  }
}
