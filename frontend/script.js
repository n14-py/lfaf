// Función para manejar el login
document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const response = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.message === 'Login exitoso') {
        // Redirigir al Dashboard
        localStorage.setItem('negocio', data.negocio); // Guardar el negocio en localStorage
        window.location.href = 'dashboard.html';
    } else {
        alert('Credenciales incorrectas');
    }
});

// Al cargar el dashboard, mostrar el nombre del negocio
if (window.location.pathname === '/dashboard.html') {
    const negocioName = localStorage.getItem('negocio');
    if (negocioName) {
        document.getElementById('negocioName').innerText = negocioName;
    } else {
        window.location.href = 'login.html'; // Redirigir a login si no hay sesión
    }
}

// Manejar el logout
document.getElementById('logoutButton')?.addEventListener('click', () => {
    localStorage.removeItem('negocio');
    window.location.href = 'login.html';
});
