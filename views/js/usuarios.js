// views/js/usuarios.js
// Pantalla solo para Administrador: usuarios del sistema y roles.
(async function () {
  const usuario = await iniciarPagina('usuarios', ['Administrador']);
  if (!usuario) return;

  const ROLES_BASE = ['Administrador', 'Gerente', 'Empleado'];
  const cuerpo = $('#cuerpo');
  const cuerpoRoles = $('#cuerpoRoles');
  const dlgUsuario = $('#dlgUsuario');
  const dlgRol = $('#dlgRol');

  function mostrarAlerta(elemento, mensaje) {
    elemento.textContent = mensaje;
    elemento.hidden = !mensaje;
  }

  // ---------- Roles ----------
  async function cargarRoles() {
    const r = await api('/api/roles');
    if (!r.ok) {
      toast(r.mensaje || 'No se pudieron cargar los roles.', 'error');
      return;
    }

    const opciones = r.roles
      .map((x) => `<option value="${x.IdRol}">${esc(x.Nombre)}</option>`)
      .join('');

    // Se vuelven a llenar las dos listas conservando su primera opción y la selección actual
    for (const lista of [$('#filtroRol'), $('#rolUsuario')]) {
      const seleccionado = lista.value;
      while (lista.options.length > 1) lista.remove(1);
      lista.insertAdjacentHTML('beforeend', opciones);
      lista.value = seleccionado;
    }

    cuerpoRoles.innerHTML = r.roles.map((x) => `<tr>
      <td><strong>${esc(x.Nombre)}</strong>
          ${ROLES_BASE.includes(x.Nombre) ? '<span class="badge gris">Base</span>' : ''}</td>
      <td class="ancho">${esc(x.Descripcion || '—')}</td>
      <td class="num">${x.Usuarios}</td>
    </tr>`).join('');
  }

  $('#btnNuevoRol').addEventListener('click', () => {
    $('#formRol').reset();
    mostrarAlerta($('#alertaRol'), '');
    dlgRol.showModal();
    $('#nombreRol').focus();
  });

  $('#formRol').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const alerta = $('#alertaRol');
    mostrarAlerta(alerta, '');

    const datos = {
      idRol: 0,                                   // id 0 = crear
      nombre: $('#nombreRol').value.trim(),
      descripcion: $('#descripcionRol').value.trim()
    };

    if (!datos.nombre) {
      mostrarAlerta(alerta, 'El nombre del rol es obligatorio.');
      return;
    }

    const boton = $('#btnGuardarRol');
    boton.disabled = true;
    const r = await api('/api/roles', { method: 'POST', body: datos });
    boton.disabled = false;

    if (!r.ok) {
      mostrarAlerta(alerta, r.mensaje || 'No se pudo guardar el rol.');
      return;
    }

    dlgRol.close();
    toast(r.mensaje);
    cargarRoles();
  });

  // ---------- Lista y búsqueda de usuarios ----------
  function filaHtml(u) {
    const esYo = u.IdUsuario === usuario.id;

    let accionEstado = '';
    if (!u.Activo) {
      accionEstado = `<button type="button" class="btn chico claro" data-accion="estado"
                        data-id="${u.IdUsuario}" data-nombre="${esc(u.NombreCompleto)}" data-activo="1">Activar</button>`;
    } else if (!esYo) {
      accionEstado = `<button type="button" class="btn chico claro" data-accion="estado"
                        data-id="${u.IdUsuario}" data-nombre="${esc(u.NombreCompleto)}" data-activo="0">Desactivar</button>`;
    }

    return `<tr>
      <td class="ancho">${esc(u.NombreCompleto)} ${esYo ? '<span class="badge gris">Tú</span>' : ''}</td>
      <td>${esc(u.Usuario)}</td>
      <td>${esc(u.Correo)}</td>
      <td>${esc(u.Rol)}</td>
      <td>${badge(u.Activo ? 'Activo' : 'Inactivo')}</td>
      <td class="acciones">
        <button type="button" class="btn chico" data-accion="editar" data-id="${u.IdUsuario}">Editar</button>
        ${accionEstado}
      </td>
    </tr>`;
  }

  async function cargarUsuarios() {
    const parametros = new URLSearchParams();
    const texto = $('#buscar').value.trim();
    if (texto) parametros.set('q', texto);
    if ($('#filtroRol').value) parametros.set('rol', $('#filtroRol').value);
    if ($('#filtroEstado').value !== '') parametros.set('estado', $('#filtroEstado').value);

    const r = await api('/api/usuarios?' + parametros.toString());
    if (!r.ok) {
      toast(r.mensaje || 'No se pudo cargar la lista de usuarios.', 'error');
      return;
    }

    cuerpo.innerHTML = r.usuarios.map(filaHtml).join('');
    $('#vacio').hidden = r.usuarios.length > 0;
  }

  $('#buscar').addEventListener('input', debounce(cargarUsuarios));
  $('#filtroRol').addEventListener('change', cargarUsuarios);
  $('#filtroEstado').addEventListener('change', cargarUsuarios);

  // ---------- Formulario crear / modificar usuario ----------
  function prepararPassword(esNuevo) {
    $('#etiquetaPassword').classList.toggle('obligatorio', esNuevo);
    $('#notaPassword').textContent = esNuevo
      ? 'Mínimo 8 caracteres.'
      : 'Déjala vacía para conservar la contraseña actual. Si escribes una, debe tener mínimo 8 caracteres.';
  }

  function abrirNuevo() {
    $('#formUsuario').reset();
    $('#idUsuario').value = '0';                 // id 0 = crear
    $('#tituloUsuario').textContent = 'Nuevo usuario';
    prepararPassword(true);
    mostrarAlerta($('#alertaUsuario'), '');
    dlgUsuario.showModal();
    $('#nombreCompleto').focus();
  }

  async function abrirEditar(id) {
    const r = await api('/api/usuarios/' + id);
    if (!r.ok) {
      // Si el id no existe, el servidor responde 404 con "El usuario no existe."
      toast(r.mensaje || 'No se pudo consultar el usuario.', 'error');
      cargarUsuarios();
      return;
    }

    const u = r.usuario;
    $('#formUsuario').reset();
    $('#idUsuario').value = String(u.IdUsuario); // id > 0 = modificar
    $('#tituloUsuario').textContent = 'Modificar usuario';
    $('#nombreCompleto').value = u.NombreCompleto;
    $('#nombreUsuario').value = u.Usuario;
    $('#correoUsuario').value = u.Correo;
    $('#rolUsuario').value = String(u.IdRol);
    prepararPassword(false);
    mostrarAlerta($('#alertaUsuario'), '');
    dlgUsuario.showModal();
  }

  $('#btnNuevoUsuario').addEventListener('click', abrirNuevo);

  $('#formUsuario').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const alerta = $('#alertaUsuario');
    mostrarAlerta(alerta, '');

    const datos = {
      idUsuario: Number($('#idUsuario').value),
      idRol: Number($('#rolUsuario').value),
      nombreCompleto: $('#nombreCompleto').value.trim(),
      usuario: $('#nombreUsuario').value.trim(),
      correo: $('#correoUsuario').value.trim(),
      password: $('#passwordUsuario').value
    };
    const confirmacion = $('#confirmarPassword').value;

    if (!datos.nombreCompleto || !datos.usuario || !datos.correo) {
      mostrarAlerta(alerta, 'El nombre, el usuario y el correo son obligatorios.');
      return;
    }
    if (!datos.idRol) {
      mostrarAlerta(alerta, 'Selecciona un rol.');
      return;
    }
    if (datos.idUsuario === 0 && !datos.password) {
      mostrarAlerta(alerta, 'La contraseña es obligatoria para un usuario nuevo.');
      return;
    }
    if (datos.password && datos.password.length < 8) {
      mostrarAlerta(alerta, 'La contraseña debe tener mínimo 8 caracteres.');
      return;
    }
    if (datos.password !== confirmacion) {
      mostrarAlerta(alerta, 'Las contraseñas no coinciden.');
      return;
    }

    const boton = $('#btnGuardarUsuario');
    boton.disabled = true;
    const r = await api('/api/usuarios', { method: 'POST', body: datos });
    boton.disabled = false;

    if (!r.ok) {
      mostrarAlerta(alerta, r.mensaje || 'No se pudo guardar el usuario.');
      if (r.estado === 404) cargarUsuarios();   // el usuario ya no existe
      return;
    }

    dlgUsuario.close();
    toast(r.mensaje);
    cargarUsuarios();
    cargarRoles();                              // actualiza el conteo de usuarios por rol
  });

  // ---------- Activar / desactivar ----------
  async function cambiarEstado(id, nombre, activo) {
    const pregunta = activo === 0
      ? `¿Desactivar la cuenta de ${nombre}? No podrá iniciar sesión.`
      : `¿Activar la cuenta de ${nombre}?`;
    if (!window.confirm(pregunta)) return;

    const r = await api(`/api/usuarios/${id}/estado`, { method: 'PATCH', body: { activo } });
    if (!r.ok) {
      toast(r.mensaje || 'No se pudo cambiar el estado.', 'error');
      return;
    }

    toast(r.mensaje);
    cargarUsuarios();
  }

  // ---------- Eventos de la tabla y de las ventanas ----------
  cuerpo.addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-accion]');
    if (!boton) return;

    if (boton.dataset.accion === 'editar') {
      abrirEditar(boton.dataset.id);
    } else if (boton.dataset.accion === 'estado') {
      cambiarEstado(boton.dataset.id, boton.dataset.nombre, Number(boton.dataset.activo));
    }
  });

  document.querySelectorAll('[data-cerrar]').forEach((b) =>
    b.addEventListener('click', () => b.closest('dialog').close())
  );

  await cargarRoles();
  cargarUsuarios();
})();