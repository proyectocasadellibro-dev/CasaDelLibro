# La Casa Del Libro

Sistema web de registros bibliotecaria para **La Casa Del Libro**. Permite administrar lectores, libros y préstamos, y reemplaza las fichas físicas y hojas de cálculo que se usan actualmente.

Proyecto de la materia *Gestión y Proyectos de Software* — UAdeO, Unidad Regional Los Mochis.

## Tecnologías

| Parte | Tecnología |
|---|---|
| Base de datos | MySQL 8 (se administra con MySQL Workbench) |
| Backend | Node.js + Express + express-session |
| Conexión a la base | mysql2 |
| Frontend | HTML, CSS y JavaScript (carpeta `public/`) |
| Control de versiones | Git + GitHub |

---

## Instalación (si apenas vas a abrir el proyecto)

Sigue los pasos en orden. Solo se hace una vez por computadora.

### 1. Instala lo necesario

| Programa | Para qué sirve | Descarga |
|---|---|---|
| Node.js (versión LTS, 20 o mayor) | Ejecutar el backend | https://nodejs.org |
| MySQL Community Server 8 + MySQL Workbench | La base de datos | https://dev.mysql.com/downloads/ |
| Git | Descargar y subir el código | https://git-scm.com |
| Visual Studio Code | Editor de código | https://code.visualstudio.com |

Durante la instalación de MySQL, anota la contraseña que le pongas al usuario `root`. La vas a necesitar.

Para comprobar que quedaron instalados, abre una terminal y ejecuta:

```bash
node -v
npm -v
git --version
```

Cada comando debe mostrar un número de versión. Si dice que no se reconoce, cierra y vuelve a abrir la terminal, o reinstala el programa.

### 2. Configura Git (solo la primera vez)

```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu-correo@ejemplo.com"
```

Usa el mismo correo de tu cuenta de GitHub.

### 3. Descarga el proyecto

Debes haber aceptado la invitación al repositorio que llegó a tu correo.

```bash
git clone https://github.com/USUARIO-DEL-DUEÑO/casadellibro.git
cd casadellibro
code .
```

Cambia `USUARIO-DEL-DUEÑO` por el usuario de GitHub que creó el repositorio. El último comando abre el proyecto en VS Code.

### 4. Instala las dependencias

En la terminal de VS Code (Ctrl + `):

```bash
npm install
```

Esto crea la carpeta `node_modules/`. No se sube a GitHub, cada quien genera la suya.

### 5. Crea tu archivo `.env`

El `.env` guarda las contraseñas de **tu** computadora y nunca se sube a GitHub. Copia el archivo de ejemplo:

```bash
# Windows (PowerShell o CMD)
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

Ábrelo y llena los datos:

```
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=casadellibro

# Usuario con el que la aplicación se conecta
DB_USER=root
DB_PASSWORD=la_contraseña_de_tu_mysql

# Usuario con permisos para crear tablas y procedimientos (lo usa npm run db:migrar)
DB_ADMIN_USER=root
DB_ADMIN_PASSWORD=la_contraseña_de_tu_mysql

SESSION_SECRET=escribe_una_frase_larga_cualquiera
```

Para empezar rápido puedes usar `root` en `DB_USER`. Si quieres un usuario con permisos mínimos, mira la sección *Usuario de la aplicación con permisos mínimos* más abajo.

### 6. Crea la base de datos

Asegúrate de que MySQL esté encendido (en Windows, el servicio **MySQL80** debe estar *Ejecutándose* en `services.msc`). Luego:

```bash
npm run db:migrar
```

Este comando ejecuta en orden los scripts de la carpeta `database/`. Debe mostrar algo como:

```
Aplicando 01_sprint1_base_de_datos.sql ...
  listo (25 sentencias)
Aplicando 02_sprint2_lectores_libros.sql ...
  listo (23 sentencias)
Aplicando 03_sprint2_guardar.sql ...
  listo (9 sentencias)

Base de datos actualizada.
```

> **Si ya habías creado la base de datos a mano en Workbench**, no ejecutes el comando normal. Corre este para marcar los scripts como ya aplicados:
>
> ```bash
> npm run db:migrar -- --marcar
> ```

### 7. Inicia el servidor

```bash
npm start
```

Abre el navegador en http://localhost:3000 (o el puerto que pusiste en `PORT`).

Para que el servidor se reinicie solo cada vez que guardas un archivo, usa `npm run dev`.

### 8. Inicia sesión con un usuario de prueba

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin12345*` | Administrador |
| `gerente` | `Gerente12345*` | Gerente |
| `empleado` | `Empleado12345*` | Empleado |

Son solo para desarrollo. Hay que cambiarlas antes de entregar el sistema.

---

## Estructura del proyecto

```
casadellibro/
├── controller/          Reciben la petición HTTP y responden (llaman a repositorios)
├── repositorios/        Llamadas a la base de datos (solo procedimientos almacenados)
├── database/            Scripts .sql numerados y el ejecutor migrar.js
├── public/              Frontend (pantallas HTML, CSS y JS)
├── server.js            Arranque del servidor y rutas
├── db.js                Conexión a MySQL
├── .env.example         Plantilla de variables de entorno
└── package.json
```

### Reglas del código

- **Toda la comunicación con la base de datos es por procedimientos almacenados.** En Node solo se escribe `CALL sp_Nombre(?, ?)`. Nunca `SELECT` ni `INSERT` sueltos.
- **Los repositorios** solo llaman procedimientos. **Los controllers** validan lo que llega, llaman al repositorio y responden. Un controller no habla directo con la base de datos.
- **Guardar usa un solo procedimiento por tabla** (`sp_GuardarLector`, `sp_GuardarLibro`):
  - `id = 0` crea un registro nuevo.
  - `id > 0` modifica ese registro.
  - Si el id no existe, la base devuelve `NULL` y el controller responde "no existe".
- Los procedimientos que modifican datos devuelven `Codigo` (0 = correcto) y `Mensaje`. Los de consulta devuelven directamente las filas.

| Codigo | Significado |
|---|---|
| 0 | Correcto |
| 1 | Dato faltante o inválido |
| 2 | Registro no encontrado |
| 3 | Duplicado |
| 4 | Regla de negocio no cumplida |
| 99 | Error inesperado |

---

## Cambios en la base de datos

Los cambios a la base se comparten como archivos `.sql` numerados dentro de `database/`.

**Quien hace el cambio:**

1. Crea un archivo **nuevo** con el siguiente número, por ejemplo `04_sprint3_prestamos.sql`.
2. Si cambia un procedimiento que ya existía, el archivo lleva `DROP PROCEDURE IF EXISTS sp_X;` y luego el `CREATE PROCEDURE` nuevo.
3. Lo prueba en su equipo con `npm run db:migrar`.
4. Lo sube en su rama con un pull request.

**Los demás**, después de que se une a `main`:

```bash
git checkout main
git pull
npm run db:migrar
```

Reglas:

- **Nunca edites un archivo `.sql` que ya fue aplicado.** Los demás ya lo ejecutaron y no volverá a correr en sus equipos. Todo cambio va en un archivo nuevo.
- Haz los scripts repetibles: `CREATE TABLE IF NOT EXISTS`, `DROP PROCEDURE IF EXISTS`, `INSERT IGNORE`.
- Para empezar de cero en tu equipo: ejecuta `DROP DATABASE casadellibro;` en Workbench y luego `npm run db:migrar`.

### Usuario de la aplicación con permisos mínimos (opcional)

En lugar de `root`, la aplicación puede conectarse con un usuario que solo ejecuta procedimientos. En Workbench:

```sql
CREATE USER IF NOT EXISTS 'casalibro_app'@'localhost' IDENTIFIED BY 'una_contraseña';
GRANT EXECUTE ON casadellibro.* TO 'casalibro_app'@'localhost';
FLUSH PRIVILEGES;
```

Después, en tu `.env`, pon `DB_USER=casalibro_app` y su contraseña en `DB_PASSWORD`. El `DB_ADMIN_USER` se queda como `root`.

---

## Trabajo en equipo con Git

La rama `main` es la versión estable. **Nadie sube cambios directo a `main`.** Cada tarea se hace en su propia rama y se une con un pull request.

### Ciclo de cada tarea

```bash
# 1. Actualiza main antes de empezar
git checkout main
git pull

# 2. Crea una rama para tu tarea
git checkout -b feature/hu05-registrar-lector

# 3. Trabaja y guarda tus cambios
git add .
git commit -m "HU05: agregar registro de lectores"

# 4. Sube tu rama
git push -u origin feature/hu05-registrar-lector
```

Después, en GitHub:

1. Haz clic en **Compare & pull request**.
2. Escribe qué cambiaste y pide a alguien que lo revise.
3. El revisor lo prueba y da **Approve**.
4. Haz clic en **Merge pull request** y luego en **Delete branch**.

Y cada quien actualiza su copia local:

```bash
git checkout main
git pull
npm run db:migrar     # solo si hubo scripts nuevos en database/
```

### Nombres de ramas

| Tipo | Ejemplo |
|---|---|
| Función nueva | `feature/hu05-registrar-lector` |
| Corrección | `fix/error-login` |
| Base de datos | `db/sprint3-prestamos` |

### Recomendaciones

- Haz `git pull` en `main` **antes** de crear una rama.
- Una rama por tarea, y que sea corta, para tener menos conflictos.
- Antes de cada `git add .`, revisa con `git status` que no aparezcan `.env` ni `node_modules`.
- Si Git marca un **conflicto** al unir ramas, VS Code muestra los botones *Accept Current* y *Accept Incoming*. Revisen juntos cuál conservar.
- Si se llega a subir el `.env`, cambia de inmediato la contraseña de MySQL: borrarlo después no lo quita del historial de Git.

---

## Rutas de la API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/login` | Inicia sesión |
| POST | `/api/logout` | Cierra sesión |
| POST | `/api/lectores` | Crea (`idLector = 0`) o modifica (`idLector > 0`) un lector |
| GET | `/api/lectores?q=texto&estado=Activo` | Busca lectores por nombre, matrícula o folio |
| GET | `/api/lectores/:id` | Consulta un lector |
| PATCH | `/api/lectores/:id/estado` | Cambia a Activo, Suspendido o Baja |
| POST | `/api/libros` | Crea (`idLibro = 0`) o modifica (`idLibro > 0`) un libro |
| GET | `/api/libros?q=texto&categoria=3` | Busca libros por título, autor, categoría o ISBN |
| GET | `/api/libros/disponibilidad?q=texto` | Disponible, Prestado o No disponible |
| GET | `/api/libros/:id` | Consulta un libro |
| GET | `/api/categorias` | Lista las categorías |

Ejemplo de cuerpo para guardar un lector nuevo:

```json
{
  "idLector": 0,
  "matricula": "23099999",
  "nombre": "Nombre del Lector",
  "correo": "lector@correo.com",
  "telefono": "6681234567"
}
```

---

## Solución de problemas

| Mensaje | Causa probable | Solución |
|---|---|---|
| `'npm' no se reconoce` | Node.js no está instalado o la terminal estaba abierta | Instala Node.js y reinicia la terminal |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL está apagado | Enciende el servicio **MySQL80** en `services.msc` |
| `Access denied for user` | Usuario o contraseña incorrectos en `.env` | Revisa `DB_USER`, `DB_PASSWORD`, `DB_ADMIN_USER` y `DB_ADMIN_PASSWORD` |
| `Unknown database 'casadellibro'` | No se ha creado la base | Ejecuta `npm run db:migrar` |
| `PROCEDURE ... does not exist` | Faltan scripts por aplicar | Ejecuta `npm run db:migrar` |
| `Cannot find module 'dotenv'` (o `mysql2`, `express`) | No se instalaron las dependencias | Ejecuta `npm install` |
| `Error en 0X_archivo.sql, sentencia N` | Un script falló | Lee el mensaje de MySQL que aparece debajo, corrige y vuelve a ejecutar `npm run db:migrar` |
| `Your local changes would be overwritten` al hacer `git pull` | Tienes cambios sin guardar en Git | Haz commit de tus cambios, o guárdalos con `git stash`, y vuelve a intentar |

---

## Equipo

| Integrante | Rol |
|---|---|
| Nadia Gabriela Sauceda Lazo | Product Owner |
| María Monserrat Vidal de la Cruz | Scrum Master |
| Ángel Gabriel Valdez Luna | Developer: backend y base de datos |
| Dilan Miguel Mendoza Borbolla | Developer: frontend e interfaz |
| Bryan Gerardo Gutiérrez Ruiz | Developer: pruebas e integración |