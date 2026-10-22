require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { pool } = require('./db');

// Controllers
const authController     = require('./Controllers/authController');
const lectoresController = require('./Controllers/lectoresController');
const librosController   = require('./Controllers/librosController');
const usuariosController = require('./Controllers/usuariosController');
const rolesController    = require('./Controllers/rolesController');

// Autorización por rol
const { requiereRol } = require('./Middleware/autorizacion');
const soloAdmin = requiereRol('Administrador');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_temporal',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 } // 8 horas
}));

// Pantallas (HTML, CSS y JS de la carpeta views/)
app.use(express.static(path.join(__dirname, 'views')));

// ---------- Acceso ----------
app.post('/api/login',  authController.login);
app.post('/api/logout', authController.logout);
app.get('/api/sesion',  authController.sesion);

// ---------- Lectores ----------
app.post('/api/lectores',             lectoresController.guardar);       // id 0 crea, id > 0 modifica
app.get('/api/lectores',              lectoresController.buscar);
app.get('/api/lectores/:id',          lectoresController.obtener);
app.patch('/api/lectores/:id/estado', lectoresController.cambiarEstado);

// ---------- Libros ----------
// (disponibilidad va ANTES de :id para que no la confunda con un id)
app.post('/api/libros',               librosController.guardar);         // id 0 crea, id > 0 modifica
app.get('/api/libros/disponibilidad', librosController.disponibilidad);
app.get('/api/libros',                librosController.buscar);
app.get('/api/libros/:id',            librosController.obtener);

// ---------- Categorías ----------
app.get('/api/categorias',            librosController.categorias);
app.post('/api/categorias',           librosController.guardarCategoria); // id 0 crea, id > 0 modifica

// ---------- Usuarios y roles (SOLO Administrador: responde 401 sin sesión y 403 sin permiso) ----------
app.get('/api/usuarios',              soloAdmin, usuariosController.listar);
app.post('/api/usuarios',             soloAdmin, usuariosController.guardar);   // id 0 crea, id > 0 modifica
app.get('/api/usuarios/:id',          soloAdmin, usuariosController.obtener);
app.patch('/api/usuarios/:id/estado', soloAdmin, usuariosController.cambiarEstado);
app.get('/api/roles',                 soloAdmin, rolesController.listar);
app.post('/api/roles',                soloAdmin, rolesController.guardar);      // id 0 crea, id > 0 modifica

// ---------- Páginas ----------
app.get('/', (req, res) => {
  res.redirect(req.session.usuario ? '/principal' : '/login.html');
});

app.get('/principal', (req, res) => {
  if (!req.session.usuario) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, 'views', 'principal.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});