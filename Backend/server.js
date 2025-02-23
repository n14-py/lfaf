const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

// Clave secreta para firmar el JWT
const JWT_SECRET = 'tu_clave_secreta';  // Cambia esto por una clave más segura

// Middleware
app.use(cors({ origin: '*' }));  // Permitir todas las solicitudes durante el desarrollo
app.use(bodyParser.json());

// Conexión a la base de datos MongoDB Atlas
const uri = 'mongodb+srv://x192024:FERFRETES805@x19.o43ibva.mongodb.net/lfac1Softwareventas?retryWrites=true&w=majority';

mongoose.connect(uri, {})
    .then(() => console.log('Conexión a MongoDB Atlas exitosa'))
    .catch(err => console.log('Error de conexión a MongoDB Atlas', err));

// Definir el esquema y el modelo de venta
const ventaSchema = new mongoose.Schema({
    producto: String,
    cantidad: Number,
    precio: Number,
    fecha: Date,
    negocio: String
});

const Venta = mongoose.model('Venta', ventaSchema);

// Definir el esquema y el modelo de usuario
const usuarioSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    contrasena: {
        type: String,
        required: true
    },
    tienda: {
        type: String,
        required: true
    }
});

const Usuario = mongoose.model('Usuario', usuarioSchema);

// Función para formatear precio (eliminar puntos y verificar si es un número)
const formatPrice = (precio) => {
    return precio.replace(/\./g, '').trim(); // Eliminar puntos y espacios
};

// Ruta para registrar usuarios
app.post('/registro', async (req, res) => {
    try {
        const { email, contrasena, tienda } = req.body;

        // Validación básica para asegurarnos que los campos no sean vacíos
        if (!email || !contrasena || !tienda) {
            return res.status(400).json({ mensaje: "Todos los campos son requeridos." });
        }

        // Verificar si el correo ya existe
        const usuarioExistente = await Usuario.findOne({ email: email });
        if (usuarioExistente) {
            return res.status(400).json({ mensaje: "El correo ya está registrado." });
        }

        // Hashear la contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(contrasena, salt);

        // Crear el nuevo usuario
        const nuevoUsuario = new Usuario({
            email: email,
            contrasena: hashedPassword,
            tienda: tienda
        });

        // Guardar el usuario en la base de datos
        await nuevoUsuario.save();

        // Enviar una respuesta de éxito
        res.status(201).json({ mensaje: "Usuario registrado con éxito." });
    } catch (error) {
        console.error("Error al registrar el usuario:", error);
        res.status(500).json({ mensaje: "Hubo un error al registrar el usuario." });
    }
});

// Ruta para hacer login
app.post('/login', async (req, res) => {
    const { email, contrasena } = req.body;

    // Validar que los campos no estén vacíos
    if (!email || !contrasena) {
        return res.status(400).json({ mensaje: 'Por favor complete ambos campos (email y contraseña).' });
    }

    // Buscar al usuario por el email
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
        return res.status(400).json({ mensaje: 'Correo electrónico no encontrado.' });
    }

    // Verificar si la contraseña coincide
    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);

    if (!contrasenaValida) {
        return res.status(400).json({ mensaje: 'Contraseña incorrecta.' });
    }

    // Generar un JWT
    const token = jwt.sign({ id: usuario._id, tienda: usuario.tienda }, JWT_SECRET, { expiresIn: '1h' });

    // Si la contraseña es correcta, devolver el token y el nombre de la tienda
    res.json({
        mensaje: 'Login exitoso',
        tienda: usuario.tienda,
        token: token  // Enviar el token al frontend
    });
});

// Middleware de autenticación
const authenticateJWT = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', ''); // Extraer token del header

    if (!token) {
        return res.status(403).json({ mensaje: 'No se proporciona un token.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ mensaje: 'Token inválido.' });
        }
        req.user = user; // Poner el usuario decodificado en la solicitud
        next();
    });
};

// Ruta para registrar una venta (requiere autenticación)
app.post('/ventas', authenticateJWT, async (req, res) => {
    const { producto, cantidad, precio } = req.body;

    // Validar que los campos no estén vacíos
    if (!producto || !cantidad || !precio) {
        return res.status(400).json({ mensaje: 'Por favor complete todos los campos.' });
    }

    // Validar que cantidad sea un número entero positivo
    if (isNaN(cantidad) || cantidad <= 0) {
        return res.status(400).json({ mensaje: 'Cantidad inválida.' });
    }

    // Validar y formatear precio (eliminar puntos y verificar si es número)
    const precioSinPuntos = formatPrice(precio);
    if (isNaN(precioSinPuntos) || parseInt(precioSinPuntos) <= 0) {
        return res.status(400).json({ mensaje: 'Precio inválido.' });
    }

    const nuevaVenta = new Venta({
        producto,
        cantidad,
        precio: parseInt(precioSinPuntos),
        fecha: new Date(), // Usar la fecha actual
        negocio: req.user.tienda // Usar la tienda del usuario autenticado
    });

    try {
        await nuevaVenta.save();
        res.status(201).json({ mensaje: 'Venta registrada exitosamente' });
    } catch (err) {
        res.status(400).json({ mensaje: 'Error al registrar la venta', error: err });
    }
});

// Ruta para obtener ventas por día (especificando la fecha)
app.get('/ventas/dia/:negocio/:fecha', async (req, res) => {
    const { negocio, fecha } = req.params;

    // Validar que la fecha tenga el formato correcto (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return res.status(400).json({ mensaje: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
    }

    // Convertir la fecha a un objeto Date en UTC
    const startOfDay = new Date(`${fecha}T00:00:00.000Z`); // Inicio del día en UTC
    const endOfDay = new Date(`${fecha}T23:59:59.999Z`);  // Fin del día en UTC

    try {
        const ventas = await Venta.find({
            negocio,
            fecha: { $gte: startOfDay, $lte: endOfDay } // Buscar entre el inicio y fin del día en UTC
        });
        res.json(ventas);
    } catch (err) {
        res.status(400).json({ mensaje: 'Error al obtener las ventas', error: err });
    }
});

// Ruta para obtener ventas por rango de fechas
app.get('/ventas/rango/:negocio/:fechaInicio/:fechaFin', async (req, res) => {
    const { negocio, fechaInicio, fechaFin } = req.params;

    // Validar que las fechas tengan el formato correcto (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
        return res.status(400).json({ mensaje: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
    }

    // Convertir las fechas a objetos Date en UTC
    const startDate = new Date(`${fechaInicio}T00:00:00.000Z`); // Inicio del rango en UTC
    const endDate = new Date(`${fechaFin}T23:59:59.999Z`);      // Fin del rango en UTC

    try {
        const ventas = await Venta.find({
            negocio,
            fecha: { $gte: startDate, $lte: endDate } // Buscar entre el inicio y fin del rango en UTC
        });
        res.json(ventas);
    } catch (err) {
        res.status(400).json({ mensaje: 'Error al obtener las ventas', error: err });
    }
});

// Ruta para obtener ventas por mes (especificando el mes)
app.get('/ventas/mes/:negocio/:mes', async (req, res) => {
    const { negocio, mes } = req.params;

    // Validar que el mes sea un número entre 1 y 12
    const mesNumero = parseInt(mes);
    if (isNaN(mesNumero) || mesNumero < 1 || mesNumero > 12) {
        return res.status(400).json({ mensaje: 'Mes inválido. Debe ser un número entre 1 y 12.' });
    }

    // Obtener el año actual
    const añoActual = new Date().getFullYear();

    // Crear fechas de inicio y fin del mes en UTC
    const startOfMonth = new Date(Date.UTC(añoActual, mesNumero - 1, 1)); // Primer día del mes en UTC
    const endOfMonth = new Date(Date.UTC(añoActual, mesNumero, 0, 23, 59, 59, 999)); // Último día del mes en UTC

    try {
        const ventas = await Venta.find({
            negocio,
            fecha: { $gte: startOfMonth, $lte: endOfMonth } // Buscar entre el inicio y fin del mes en UTC
        });
        res.json(ventas);
    } catch (err) {
        res.status(400).json({ mensaje: 'Error al obtener las ventas del mes', error: err });
    }
});

// Ruta para obtener todos los datos de ventas de un negocio
app.get('/ventas/:negocio', authenticateJWT, async (req, res) => {
    const { negocio } = req.params;
    try {
        const ventas = await Venta.find({ negocio });
        res.json(ventas);
    } catch (err) {
        res.status(400).json({ mensaje: 'Error al obtener las ventas', error: err });
    }
});

// Ruta para editar una venta
app.put('/ventas/:id', authenticateJWT, async (req, res) => {
    const { id } = req.params;
    const { precio } = req.body;

    // Validar que el precio no esté vacío
    if (!precio) {
        return res.status(400).json({ mensaje: 'El precio es requerido.' });
    }

    // Formatear y validar el precio
    const precioSinPuntos = formatPrice(precio);
    if (isNaN(precioSinPuntos) || parseInt(precioSinPuntos) <= 0) {
        return res.status(400).json({ mensaje: 'Precio inválido.' });
    }

    try {
        // Actualizar solo el precio de la venta
        const venta = await Venta.findByIdAndUpdate(
            id,
            { precio: parseInt(precioSinPuntos) }, // Solo actualizamos el precio
            { new: true } // Devuelve el documento actualizado
        );

        res.json({ mensaje: 'Precio actualizado exitosamente', venta });
    } catch (err) {
        res.status(400).json({ mensaje: 'Error al actualizar el precio', error: err });
    }
});

// Ruta para eliminar una venta
app.delete('/ventas/:id', authenticateJWT, async (req, res) => {
    const { id } = req.params;

    try {
        await Venta.findByIdAndDelete(id);
        res.json({ mensaje: 'Venta eliminada exitosamente' });
    } catch (err) {
        res.status(400).json({ mensaje: 'Error al eliminar la venta', error: err });
    }
});

// Servir archivos estáticos (tu carpeta frontend)
app.use(express.static(path.join(__dirname, '../frontend')));

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});