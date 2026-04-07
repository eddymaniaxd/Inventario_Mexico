const bcrypt = require('bcryptjs');

async function hashPassword() {
    const password = 'admin123'; // Cambia por la contraseña que quieras
    const hash = await bcrypt.hash(password, 10);
    console.log('Contraseña:', password);
    console.log('Hash:', hash);
}

hashPassword();