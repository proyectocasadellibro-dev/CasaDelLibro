const form = document.getElementById('formLogin');
const errorEl = document.getElementById('error');
const btn = document.getElementById('btnEntrar');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: document.getElementById('usuario').value.trim(),
        password: document.getElementById('password').value
      })
    });
    const data = await resp.json();

    if (data.ok) {
      window.location.href = '/principal';
    } else {
      errorEl.textContent = data.mensaje;
      errorEl.hidden = false;
    }
  } catch (err) {
    errorEl.textContent = 'No se pudo comunicar con el servidor.';
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});
