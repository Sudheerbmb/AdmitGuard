/* AdmitGuard — auth.js */
/* Administrative Session Guard & Identity Management */

(function() {
  const user = sessionStorage.getItem('admitguard_admin_user');
  
  // If no user session, redirect to login immediately
  if (!user) {
    if (window.location.pathname.indexOf('index.html') === -1) {
      window.location.href = 'index.html';
    }
  } else {
    // If we have a user, handle UI integration once DOM is ready
    const userData = JSON.parse(user);
    
    document.addEventListener('DOMContentLoaded', () => {
      // Add profile info to header if it exists
      const headerRight = document.querySelector('.header-right');
      if (headerRight) {
        const profileDiv = document.createElement('div');
        profileDiv.style.display = 'flex';
        profileDiv.style.alignItems = 'center';
        profileDiv.style.gap = '12px';
        profileDiv.style.marginRight = '20px';
        profileDiv.innerHTML = `
          <div style="text-align: right; margin-right: 8px;">
            <div style="font-weight: 700; font-size: 11px;">${userData.name}</div>
            <div style="color: var(--muted); font-size: 8px;">${userData.email}</div>
          </div>
          <img src="${userData.picture}" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--accent);">
          <button id="logoutBtn" style="background: none; border: 1px solid var(--border); color: var(--muted); border-radius: 6px; padding: 4px 8px; font-size: 8px; cursor: pointer;">LOGOUT</button>
        `;
        headerRight.insertAdjacentElement('afterbegin', profileDiv);
        
        document.getElementById('logoutBtn').addEventListener('click', () => {
          sessionStorage.removeItem('admitguard_admin_user');
          window.location.href = 'index.html';
        });
      }
    });
  }
})();
