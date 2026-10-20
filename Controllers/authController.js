
const usuariosRepo = require('../Repositories/UsuariosRepositorio');

async function login(req, res) {
  const { usuario, password } = req.body || {};

  if (!usuario || !password) {
    return res.status(400).json({ ok: false, mensaje: 'Escribe usuario y contraseña.' });
  }

  try {
    const fila = await usuariosRepo.iniciarSesion(usuario, password);

    if (!fila) {
      return res.status(500).json({ ok: false, mensaje: 'Error al iniciar sesión.' });
    }
    if (fila.Codigo !== 0) {
      // Credenciales incorrectas (1) o cuenta desactivada (2) -> 401
      return res.status(401).json({ ok: false, mensaje: fila.Mensaje });
    }

    req.session.usuario = {
      id: fila.IdUsuario,
      nombre: fila.NombreCompleto,
      rol: fila.Rol
    };

    res.json({ ok: true, usuario: req.session.usuario });
  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ ok: false, mensaje: 'No se pudo conectar con la base de datos.' });
  }
}

function logout(req, res) {
  req.session.destroy(() => res.json({ ok: true }));
}

module.exports = { login, logout };