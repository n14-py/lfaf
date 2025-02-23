document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ventaForm');
    const ventasTable = document.getElementById('ventasTable').getElementsByTagName('tbody')[0];
    const totalDiaElem = document.getElementById('totalDia');
    const totalMesElem = document.getElementById('totalMes');
    const exportarDia = document.getElementById('exportarDia');
    const exportarMes = document.getElementById('exportarMes');
    const negocio = "miNegocio"; // Esto debe ser dinámico, basado en el login del usuario

    // Función para actualizar la tabla y las sumas
    function actualizarTabla(ventas) {
        ventasTable.innerHTML = '';
        let totalDia = 0;
        let totalMes = 0;
        ventas.forEach(venta => {
            const row = ventasTable.insertRow();
            row.insertCell(0).textContent = venta.producto;
            row.insertCell(1).textContent = venta.cantidad;
            row.insertCell(2).textContent = venta.precio;
            const totalVenta = venta.cantidad * venta.precio;
            row.insertCell(3).textContent = totalVenta;

            // Sumar totales del día y mes
            const fecha = new Date(venta.fecha);
            const hoy = new Date();
            if (fecha.toDateString() === hoy.toDateString()) {
                totalDia += totalVenta;
            }
            if (fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear()) {
                totalMes += totalVenta;
            }
        });

        totalDiaElem.textContent = `Total: Gs ${totalDia}`;
        totalMesElem.textContent = `Total: Gs ${totalMes}`;
    }

    // Registrar una venta
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const producto = document.getElementById('producto').value;
        const cantidad = parseInt(document.getElementById('cantidad').value);
        const precio = parseInt(document.getElementById('precio').value);

        const response = await fetch('/ventas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ negocio, producto, cantidad, precio })
        });

        const result = await response.json();
        alert(result.message);
        form.reset();
        obtenerVentas();
    });

    // Obtener las ventas desde el backend
    async function obtenerVentas() {
        const response = await fetch(`/ventas/${negocio}`);
        const ventas = await response.json();
        actualizarTabla(ventas);
    }

    // Exportar ventas
    exportarDia.addEventListener('click', async () => {
        const response = await fetch(`/exportar/${negocio}?dia=true`);
        const data = await response.blob();
        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ventas_dia_${new Date().toLocaleDateString()}.csv`;
        link.click();
    });

    exportarMes.addEventListener('click', async () => {
        const response = await fetch(`/exportar/${negocio}?mes=true`);
        const data = await response.blob();
        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ventas_mes_${new Date().toLocaleDateString()}.csv`;
        link.click();
    });

    // Cargar las ventas al iniciar
    obtenerVentas();
});
