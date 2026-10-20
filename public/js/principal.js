(async function () {
  // Pide los datos de la sesión; si no hay, regresa al login
  const resp = await fetch('/api/me');
  if (!resp.ok) {
    window.location.href = '/login.html';
    return;
  }
  const { usuario } = await resp.json();

  document.getElementById('nombreUsuario').textContent = usuario.nombre;
  document.getElementById('rolUsuario').textContent = usuario.rol;
  document.getElementById('bienvenida').textContent = 'Bienvenido, ' + usuario.nombre;

  // El frontend decide qué módulos ve cada rol
  document.querySelectorAll('[data-roles]').forEach((el) => {
    const roles = el.dataset.roles.split(',');
    if (!roles.includes(usuario.rol)) el.remove();
  });

  document.getElementById('btnSalir').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });
})();
