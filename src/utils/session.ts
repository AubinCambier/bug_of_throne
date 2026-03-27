const SESSION_TOKEN_KEY = 'session_token';

export function hasSession(): boolean {
  return Boolean(localStorage.getItem(SESSION_TOKEN_KEY));
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function getSessionToken(): string {
  return localStorage.getItem(SESSION_TOKEN_KEY) ?? '';
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
}
