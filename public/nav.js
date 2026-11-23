// Shows the Admin button in the sidebar, but only for admins.
// The server decides who is an admin; this just hides or shows a link.
const KEY = 'clearpathIsAdmin';

function setLink(show) {
  const link = document.getElementById('adminLink');
  if (link) link.hidden = !show;
}

// If we already learned in this tab that the user is an admin, show the
// button right away so it does not flicker when changing pages.
try {
  if (sessionStorage.getItem(KEY) === '1') setLink(true);
} catch (error) {
  // storage can be blocked, the button then just appears a moment later
}

export async function showAdminLink(user) {
  try {
    const token = await user.getIdToken();
    const res = await fetch('api/me', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) return;
    const me = await res.json();
    const isAdmin = me.role === 'admin';
    setLink(isAdmin);
    try {
      sessionStorage.setItem(KEY, isAdmin ? '1' : '0');
    } catch (error) {
      // ignore
    }
  } catch (error) {
    // if this fails the admin button just stays as it was
  }
}
