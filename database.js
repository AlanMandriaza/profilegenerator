const mysql = require('mysql2');
const config = require('./config.json');

// Crear una conexión a MySQL
const connection = mysql.createConnection({
  host: config.host,
  user: config.user,
  password: config.password
});

// Conectar a MySQL
connection.connect((err) => {
  if (err) {
    console.error('Error connecting: ' + err.stack);
    return;
  }
  console.log('Connected as id ' + connection.threadId);
});

// Crear base de datos y tablas
const setupDatabase = () => {
  // Crear base de datos si no existe
  connection.query('CREATE DATABASE IF NOT EXISTS profiles_db', (err) => {
    if (err) {
      console.error('Error creating database: ' + err.message);
      connection.end();
      return;
    }
    console.log('Database `profiles_db` created or already exists.');

    // Cambiar el contexto de la conexión a la base de datos recién creada
    connection.changeUser({ database: 'profiles_db' }, (err) => {
      if (err) {
        console.error('Error changing database: ' + err.message);
        connection.end();
        return;
      }

      // Crear las tablas si no existen
      const createValidosTable = `CREATE TABLE IF NOT EXISTS validos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        url VARCHAR(255) NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE
      )`;

      const createInvalidosTable = `CREATE TABLE IF NOT EXISTS invalidos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        url VARCHAR(255) NOT NULL
      )`;

      connection.query(createValidosTable, (err) => {
        if (err) {
          console.error('Error creating table `validos`: ' + err.message);
          connection.end();
          return;
        }
        console.log('Table `validos` created or already exists.');

        connection.query(createInvalidosTable, (err) => {
          if (err) {
            console.error('Error creating table `invalidos`: ' + err.message);
          } else {
            console.log('Table `invalidos` created or already exists.');
          }
          connection.end(); // Cerrar la conexión después de crear las tablas
        });
      });
    });
  });
};

// Ejecutar la configuración de la base de datos
setupDatabase();