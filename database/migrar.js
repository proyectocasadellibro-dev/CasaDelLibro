// database/migrar.js
// Ejecuta los scripts .sql de esta carpeta, en orden (01_, 02_, 03_...),
// y recuerda cuáles ya aplicó en la tabla "migraciones" de tu base de datos local.
//
// Uso:
//   npm run db:migrar              -> aplica solo los scripts nuevos
//   npm run db:migrar -- --marcar  -> marca todos como ya aplicados SIN ejecutarlos
//                                     (para quien ya creó su base de datos a mano)
//
// Necesita en el .env un usuario con permisos para crear tablas y procedimientos:
//   DB_ADMIN_USER y DB_ADMIN_PASSWORD (en local normalmente root).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Divide un script en sentencias respetando los DELIMITER de MySQL Workbench
function dividirSentencias(sql) {
  const sentencias = [];
  let delimitador = ';';
  let actual = '';

  const guardar = (texto) => {
    const sinComentarios = texto
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*--.*$/gm, '')
      .trim();
    if (sinComentarios) sentencias.push(texto.trim());
  };

  for (const linea of sql.split(/\r?\n/)) {
    const cambio = linea.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (cambio) {
      delimitador = cambio[1];
      continue;
    }
    actual += linea + '\n';
    const texto = actual.trimEnd();
    if (texto.endsWith(delimitador)) {
      guardar(texto.slice(0, -delimitador.length));
      actual = '';
    }
  }
  guardar(actual); // lo que haya quedado sin delimitador final
  return sentencias;
}

async function main() {
  const soloMarcar = process.argv.includes('--marcar');
  const baseDatos = process.env.DB_NAME || 'casadellibro';

  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_ADMIN_USER || 'root',
    password: process.env.DB_ADMIN_PASSWORD || '',
    charset: 'utf8mb4'
  });

  try {
    await conexion.query(
      `CREATE DATABASE IF NOT EXISTS \`${baseDatos}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conexion.query(`USE \`${baseDatos}\``);
    await conexion.query(`
      CREATE TABLE IF NOT EXISTS migraciones (
        nombre      VARCHAR(200) PRIMARY KEY,
        aplicada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);

    const [filas] = await conexion.query('SELECT nombre FROM migraciones');
    const aplicadas = new Set(filas.map((f) => f.nombre));

    const archivos = fs
      .readdirSync(__dirname)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pendientes = archivos.filter((f) => !aplicadas.has(f));
    if (pendientes.length === 0) {
      console.log('La base de datos ya está al día.');
      return;
    }

    for (const archivo of pendientes) {
      if (soloMarcar) {
        await conexion.query('INSERT INTO migraciones (nombre) VALUES (?)', [archivo]);
        console.log(`Marcado como aplicado: ${archivo}`);
        continue;
      }

      console.log(`Aplicando ${archivo} ...`);
      const sql = fs.readFileSync(path.join(__dirname, archivo), 'utf8');
      const sentencias = dividirSentencias(sql);

      for (let i = 0; i < sentencias.length; i++) {
        try {
          await conexion.query(sentencias[i]);
        } catch (err) {
          console.error(`\nError en ${archivo}, sentencia ${i + 1}:`);
          console.error(sentencias[i].split('\n').slice(0, 4).join('\n') + '\n  ...');
          console.error(`MySQL dice: ${err.message}`);
          process.exitCode = 1;
          return; // no se registra el archivo; corrige y vuelve a ejecutar
        }
      }

      await conexion.query('INSERT INTO migraciones (nombre) VALUES (?)', [archivo]);
      console.log(`  listo (${sentencias.length} sentencias)`);
    }
    console.log('\nBase de datos actualizada.');
  } finally {
    await conexion.end();
  }
}

module.exports = { dividirSentencias };

if (require.main === module) {
  main().catch((err) => {
    console.error('No se pudo conectar o ejecutar:', err.message);
    process.exit(1);
  });
}