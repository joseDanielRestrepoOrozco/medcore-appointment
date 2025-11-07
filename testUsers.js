// testUsers.js
(async () => {
  try {
    const client = require('./dist/libs/usersClient');
    const id = process.argv[2] || 'ID_DE_PRUEBA';
    console.log('Consultando users service por id:', id);
    const user = await client.getUserById(id);
    console.log('Respuesta user:', user);
  } catch (err) {
    console.error('Error al consultar users service:', err.message || err);
    if (err.status) console.error('HTTP status from users service:', err.status);
  }
})();