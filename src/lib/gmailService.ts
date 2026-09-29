let memoryAccessToken: string | null = null;

/**
 * Guarda o limpia el token de acceso de Google OAuth en memoria y sessionStorage
 */
export function setCachedGoogleAccessToken(token: string | null): void {
  memoryAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      try {
        sessionStorage.setItem('vxp_google_access_token', token);
      } catch (err) {
        console.warn('No se pudo guardar el token en sessionStorage:', err);
      }
    } else {
      try {
        sessionStorage.removeItem('vxp_google_access_token');
      } catch (err) {
        console.warn('No se pudo remover el token de sessionStorage:', err);
      }
    }
  }
}

/**
 * Obtiene el token de acceso de Google OAuth si está disponible
 */
export function getCachedGoogleAccessToken(): string | null {
  if (memoryAccessToken) return memoryAccessToken;
  if (typeof window !== 'undefined') {
    try {
      return sessionStorage.getItem('vxp_google_access_token');
    } catch (err) {
      return null;
    }
  }
  return null;
}

/**
 * Genera un enlace de composición de Gmail listo para abrir en el navegador
 */
export function generateGmailComposeUrl(toEmail: string, subject: string, bodyText: string): string {
  const cleanTo = (toEmail || '').trim();
  const encTo = encodeURIComponent(cleanTo);
  const encSub = encodeURIComponent(subject || '');
  const encBody = encodeURIComponent(bodyText || '');
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encTo}&su=${encSub}&body=${encBody}`;
}

export interface SendGmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  bodyText?: string;
  accessToken?: string;
}

/**
 * Envía un correo electrónico directamente usando la API REST de Gmail
 */
export async function sendEmailViaGmailApi(options: SendGmailOptions): Promise<{ id?: string; success: boolean }> {
  const token = options.accessToken || getCachedGoogleAccessToken();
  if (!token) {
    throw new Error('No se encontró el token de acceso de Google para enviar correos vía Gmail API.');
  }

  const encodedSubject = btoa(unescape(encodeURIComponent(options.subject)));
  const mimeMessage = [
    `To: ${options.to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: =?utf-8?B?${encodedSubject}?=`,
    '',
    options.htmlBody || options.bodyText || '',
  ].join('\r\n');

  const raw = btoa(unescape(encodeURIComponent(mimeMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Error al enviar correo vía Gmail API (HTTP ${response.status})`
    );
  }

  const data = await response.json();
  return { id: data.id, success: true };
}
