// views/js/principal.js
(async function () {
  const usuario = await iniciarPagina('inicio');
  if (!usuario) return;

  $('#saludo').textContent = `Hola, ${usuario.nombre}`;
  $('#avisoConsulta').hidden = usuario.puedeEditar;
  $('#opcionUsuarios').hidden = usuario.rol !== 'Administrador';
})();