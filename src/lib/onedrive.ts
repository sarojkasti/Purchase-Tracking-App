/**
 * Microsoft Graph / OneDrive helper.
 * Uses app-only (client credentials) auth — no user sign-in required.
 *
 * Required env vars:
 *   MICROSOFT_TENANT_ID      — Azure AD tenant ID
 *   MICROSOFT_CLIENT_ID      — App registration client ID
 *   MICROSOFT_CLIENT_SECRET  — App registration client secret
 *   ONEDRIVE_USER_EMAIL      — The M365 user whose OneDrive to upload into
 *                              (e.g. itdepartment@newmew.com)
 *   ONEDRIVE_FOLDER_PATH     — Folder path inside OneDrive (e.g. "PO-Attachments")
 */

const TENANT_ID = process.env.MICROSOFT_TENANT_ID!;
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET!;
const USER_EMAIL = process.env.ONEDRIVE_USER_EMAIL!;
const FOLDER_PATH = process.env.ONEDRIVE_FOLDER_PATH ?? "PO-Attachments";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );
  if (!res.ok) throw new Error(`Token fetch failed: ${await res.text()}`);
  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export async function uploadToOneDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const token = await getAccessToken();

  // Ensure folder exists by uploading with full path
  const encodedPath = encodeURIComponent(`${FOLDER_PATH}/${fileName}`);
  const uploadUrl = `https://graph.microsoft.com/v1.0/users/${USER_EMAIL}/drive/root:/${encodedPath}:/content`;

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": mimeType,
    },
    body: buffer,
  });

  if (!uploadRes.ok) throw new Error(`OneDrive upload failed: ${await uploadRes.text()}`);
  const item = await uploadRes.json();
  const itemId: string = item.id;

  // Create an "anyone with link can view" sharing link
  const linkRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${USER_EMAIL}/drive/items/${itemId}/createLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "view", scope: "anonymous" }),
    }
  );

  if (!linkRes.ok) throw new Error(`Sharing link creation failed: ${await linkRes.text()}`);
  const linkData = await linkRes.json();
  return linkData.link.webUrl as string;
}

export function isOneDriveConfigured(): boolean {
  return !!(TENANT_ID && CLIENT_ID && CLIENT_SECRET && USER_EMAIL);
}
