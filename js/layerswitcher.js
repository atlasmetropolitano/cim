document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("layer-switcher-btn");
    const panel = document.getElementById("layer-switcher-panel");
    const options = panel.querySelectorAll(".layer-option");

    // Mostrar/ocultar panel al hacer clic en el botón
    btn.addEventListener("click", () => {
        panel.classList.toggle("active");
    });

    // Ocultar panel al hacer clic fuera de él
    document.addEventListener("click", (e) => {
        if (!btn.contains(e.target) && !panel.contains(e.target)) {
            panel.classList.remove("active");
        }
    });

    // Definir los mapas base
    const baseLayers = {
        "osm": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }),
        "gmap": L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            attribution: 'Google Maps'
        }),
        "gsat": L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            attribution: 'Google Satélite'
        }),
    };

    // Agregar el mapa base OSM al inicio
    let currentLayer = "osm";
    baseLayers.osm.addTo(window.map);

    options.forEach(option => {
        option.addEventListener("click", () => {
            // Cambiar la capa base
            if (window.map.hasLayer(baseLayers[currentLayer])) {
                window.map.removeLayer(baseLayers[currentLayer]);
            }
            const next = option.getAttribute("data-layer");
            baseLayers[next].addTo(window.map);
            currentLayer = next;

            // Marcar selección visual
            options.forEach(opt => opt.classList.remove("selected"));
            option.classList.add("selected");

            // Ocultar el panel tras seleccionar
            panel.classList.remove("active");
        });
    });
});
