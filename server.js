require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { pool } = require('./db');   
const authController = require('./Controllers/authController');
const lectoresController = require('./Controllers/lectoresController.js');
const librosController = require('./Controllers/librosController');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_temporal',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 } // 8 horas
}));



// Acceso
app.post('/api/login',  authController.login);
app.post('/api/logout', authController.logout);

// Lectores
app.post('/api/lectores',             lectoresController.guardar);       // id 0 crea, id > 0 modifica
app.get('/api/lectores',              lectoresController.buscar);
app.get('/api/lectores/:id',          lectoresController.obtener);
app.patch('/api/lectores/:id/estado', lectoresController.cambiarEstado);

// Libros (disponibilidad va ANTES de :id para que no la confunda con un id)
app.post('/api/libros',               librosController.guardar);         // id 0 crea, id > 0 modifica
app.get('/api/libros/disponibilidad', librosController.disponibilidad);
app.get('/api/libros',                librosController.buscar);
app.get('/api/libros/:id',            librosController.obtener);
app.get('/api/categorias',            librosController.categorias);

app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => {
  res.redirect(req.session.usuario ? '/principal' : '/login.html');
});


app.get('/principal', (req, res) => {
  if (!req.session.usuario) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, 'views', 'principal.html'));
});

app.get('/api/me', (req, res) => {
  if (!req.session.usuario) return res.status(401).json({ ok: false });
  res.json({ ok: true, usuario: req.session.usuario });
});


app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});
