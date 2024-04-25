export function setSessionCookie(sessionValue: string, passwordValue: string) {
  document.cookie = `session=${sessionValue}; expires=${new Date(
    Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
  )}; path=/;`;

  if (passwordValue) {
    document.cookie = `password=${passwordValue}; expires=${new Date(
      Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    )}; path=/;`;
  }
}
