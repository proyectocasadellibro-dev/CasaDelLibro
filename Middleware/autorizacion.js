// Middleware/autorizacion.js
// Protege rutas según el rol guardado en la sesión.
//
//   app.get('/api/usuarios', requiereRol('Administrador'), usuariosController.listar);

function requiereSesion(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ ok: false, mensaje: 'Inicia sesión para continuar.' });
  }
  next();
}

function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    const usuario = req.session && req.session.usuario;

    if (!usuario) {
      return res.status(401).json({ ok: false, mensaje: 'Inicia sesión para continuar.' });
    }
    if (!rolesPermitidos.includes(usuario.rol)) {
      return res.status(403).json({ ok: false, mensaje: 'No tienes permiso para realizar esta acción.' });
    }
    next();
  };
}

module.exports = { requiereSesion, requiereRol };