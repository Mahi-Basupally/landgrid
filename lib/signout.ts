export async function signOut() {
  try {
    await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    window.location.href = '/login';
  }
}
