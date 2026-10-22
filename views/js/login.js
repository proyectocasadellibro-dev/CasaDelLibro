// views/js/login.js
(async function () {
  // Si ya hay una sesión activa, ir directo al inicio
  const sesion = await api('/api/sesion');
  if (sesion.ok && sesion.usuario) {
    window.location.href = '/principal';
    return;
  }

  const alerta = $('#alertaLogin');
  const boton = $('#btnEntrar');

  function mostrarError(mensaje) {
    alerta.textContent = mensaje;
    alerta.hidden = !mensaje;
  }

  $('#formLogin').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mostrarError('');

    const usuario = $('#usuario').value.trim();
    const password = $('#password').value;

    if (!usuario || !password) {
      mostrarError('Escribe usuario y contraseña.');
      return;
    }

    boton.disabled = true;
    boton.textContent = 'Entrando…';

    const r = await api('/api/login', { method: 'POST', body: { usuario, password } });

    if (!r.ok) {
      mostrarError(r.mensaje || 'No se pudo iniciar sesión.');
      boton.disabled = false;
      boton.textContent = 'Entrar';
      $('#password').select();
      return;
    }

    window.location.href = '/principal';
  });
})();