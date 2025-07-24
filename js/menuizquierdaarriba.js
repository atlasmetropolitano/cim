// ✅ VERSIÓN COMPLETA MEJORADA DE menuizquierdaarriba.js

// Consolas iniciales
console.log("✅ menuizquierdaarriba.js se ha cargado correctamente.");
console.log("🔍 Verificando si los botones del menú existen...");
console.log("Zoom In:", document.getElementById("btn-zoom-in"));
console.log("Zoom Out:", document.getElementById("btn-zoom-out"));
console.log("Restablecer:", document.getElementById("btn-reset"));
console.log("Alternar Capa:", document.getElementById("btn-toggle-layer"));

// 📦 Menú toolbox toggle
const toolbox = document.querySelector(".toolbox");
const toggleToolboxBtn = document.getElementById("toggle-toolbox");

if (toggleToolboxBtn) {
    toggleToolboxBtn.addEventListener("click", () => {
        toolbox.classList.toggle("hidden");
        toggleToolboxBtn.classList.toggle("active");
        toolbox.style.left = toolbox.classList.contains("hidden") ? "60px" : "50px";
    });
}

// DOM principal
window.addEventListener("DOMContentLoaded", () => {
    const map = window.map;

    // Zoom y vista
    const zoomInBtn = document.getElementById("btn-zoom-in");
    const zoomOutBtn = document.getElementById("btn-zoom-out");
    const resetBtn = document.getElementById("btn-reset");
    const toggleLayerBtn = document.getElementById("btn-toggle-layer");

    zoomInBtn?.addEventListener("click", () => map.zoomIn());
    zoomOutBtn?.addEventListener("click", () => map.zoomOut());
    resetBtn?.addEventListener("click", () => map.setView([-34.60, -58.50], 10));

    if (toggleLayerBtn) {
        let isLayerVisible = true;
        toggleLayerBtn.addEventListener("click", () => {
            if (window.lastLayer) {
                isLayerVisible ? map.removeLayer(window.lastLayer) : window.lastLayer.addTo(map);
                isLayerVisible = !isLayerVisible;
            }
        });
    }

    // 🧭 Geolocalización del usuario
document.getElementById("btn-locate-user").addEventListener("click", () => {
    if (!navigator.geolocation) {
        alert("La geolocalización no es compatible con este navegador.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            const userMarker = L.marker([latitude, longitude]).addTo(map);
            userMarker.bindPopup("📍 Estás aquí").openPopup();
            map.setView([latitude, longitude], 14);
        },
        (error) => {
            alert("No se pudo obtener tu ubicación.");
            console.error("Error de geolocalización:", error);
        },
        { enableHighAccuracy: true }
    );
});


    // 🔍 Buscar dirección usando Nominatim (OpenStreetMap)
document.getElementById("btn-search-address").addEventListener("click", () => {
    const query = document.getElementById("address-search").value;
    if (!query) return alert("Por favor, ingrese una dirección o lugar");

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(results => {
            if (!results.length) return alert("Dirección no encontrada");
            const { lat, lon } = results[0];
            map.setView([parseFloat(lat), parseFloat(lon)], 15);
            L.marker([lat, lon]).addTo(map).bindPopup("📍 Resultado de búsqueda").openPopup();
        })
        .catch(err => alert("Error buscando dirección: " + err));
});


    // Captura e impresión
    const printMapBtn = document.getElementById("btn-print-map");
    const screenshotMapBtn = document.getElementById("btn-screenshot-map");

    printMapBtn?.addEventListener("click", () => {
        const elementsToHide = document.querySelectorAll(
            ".toolbox, .fab-container, .menu-box, .panel, #wms-info-box"
        );
        elementsToHide.forEach(el => el.style.display = "none");

        const mapElement = document.getElementById("map");
        const original = { position: mapElement.style.position, zIndex: mapElement.style.zIndex };

        Object.assign(mapElement.style, { position: "absolute", zIndex: "9999", width: "100%", height: "100vh" });

        setTimeout(() => {
            window.print();
            elementsToHide.forEach(el => el.style.display = "");
            Object.assign(mapElement.style, original);
        }, 500);
    });

    screenshotMapBtn?.addEventListener("click", () => {
        const mapElement = document.getElementById("map");
        mapElement.style.width = "100%";
        mapElement.style.height = "100vh";
        html2canvas(mapElement, { useCORS: true, scale: 2 })
            .then(canvas => {
                const link = document.createElement("a");
                link.href = canvas.toDataURL("image/png");
                link.download = "captura_mapa.png";
                link.click();
                mapElement.style.width = "";
                mapElement.style.height = "";
            });
    });

    // Descarga de capas GeoJSON
    document.getElementById("btn-download-geojson")?.addEventListener("click", () => {
        let geojsonLayers = [], layerNames = [];
        map.eachLayer(layer => {
            if (layer instanceof L.GeoJSON) {
                geojsonLayers.push(layer);
                layerNames.push(layer.options?.geojsonName || `capa_${geojsonLayers.length}.geojson`);
            }
        });

        if (geojsonLayers.length === 0) return alert("No hay capas GeoJSON visibles.");
        if (geojsonLayers.length === 1) return downloadGeoJSONFile(geojsonLayers[0], layerNames[0]);

        const choice = prompt(`Elige cuál descargar:\n${layerNames.map((n, i) => `(${i+1}) ${n}`).join("\n")}`);
        const index = parseInt(choice) - 1;
        if (!geojsonLayers[index]) return alert("Opción inválida.");
        downloadGeoJSONFile(geojsonLayers[index], layerNames[index]);
    });

    function downloadGeoJSONFile(layer, filename) {
        const data = layer.toGeoJSON();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    // Subir GeoJSON externo
    document.getElementById("btn-upload-geojson")?.addEventListener("click", () => {
        document.getElementById("geojson-input")?.click();
    });

    document.getElementById("geojson-input")?.addEventListener("change", function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const geojsonData = JSON.parse(e.target.result);
            if (window.externalGeojsonLayer) map.removeLayer(window.externalGeojsonLayer);

            window.externalGeojsonLayer = L.geoJSON(geojsonData, {
                onEachFeature: (f, l) => {
                    let popup = "<b>Atributos:</b><br>";
                    for (let key in f.properties) popup += `<b>${key}:</b> ${f.properties[key]}<br>`;
                    l.bindPopup(popup);
                }
            }).addTo(map);

            map.fitBounds(window.externalGeojsonLayer.getBounds());
        };
        reader.readAsText(file);
    });

    // WMS
    document.getElementById("btn-load-wms")?.addEventListener("click", () => {
        const wmsUrl = prompt("Ingrese la URL del servicio WMS:");
        if (!wmsUrl) return;

        fetch(`${wmsUrl}?service=WMS&request=GetCapabilities&version=1.3.0`)
            .then(resp => resp.text())
            .then(text => {
                const xml = new DOMParser().parseFromString(text, "text/xml");
                const layers = [...xml.getElementsByTagName("Layer")]?.map(l => {
                    return {
                        name: l.getElementsByTagName("Name")[0]?.textContent,
                        title: l.getElementsByTagName("Title")[0]?.textContent
                    }
                }).filter(l => l.name);

                if (!layers.length) return alert("No se encontraron capas.");

                document.getElementById("wms-data").innerHTML = `
                    <label>Selecciona una capa:</label>
                    <select id="wms-layer-select">
                        ${layers.map(l => `<option value="${l.name}">${l.title}</option>`).join("")}
                    </select>
                    <button id="btn-add-wms-layer">Cargar Capa</button>
                `;

                document.getElementById("wms-info-box").classList.replace("hidden", "show");

                document.getElementById("btn-add-wms-layer").addEventListener("click", () => {
                    const selected = document.getElementById("wms-layer-select").value;
                    if (window.wmsLayer) map.removeLayer(window.wmsLayer);
                    window.wmsLayer = L.tileLayer.wms(wmsUrl, {
                        layers: selected,
                        format: "image/png",
                        transparent: true
                    }).addTo(map);
                });
            })
            .catch(err => alert("Error al obtener WMS: " + err));
    });

    document.getElementById("close-wms")?.addEventListener("click", () => {
        document.getElementById("wms-info-box").classList.replace("show", "hidden");
        if (window.wmsLayer) map.removeLayer(window.wmsLayer);
    });
});

// Cuadro flotante WMS arrastrable
function makeDraggable(el) {
    let isMouseDown = false, offsetX = 0, offsetY = 0;
    el.style.position = "fixed";
    el.style.cursor = "move";

    el.addEventListener("mousedown", function(e) {
        isMouseDown = true;
        el.style.transform = "";
        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
    });

    document.addEventListener("mousemove", function(e) {
        if (isMouseDown) {
            el.style.left = (e.clientX - offsetX) + "px";
            el.style.top = (e.clientY - offsetY) + "px";
        }
    });

    document.addEventListener("mouseup", () => isMouseDown = false);
}

window.addEventListener("DOMContentLoaded", () => {
    const box = document.getElementById("wms-info-box");
    if (box) makeDraggable(box);
});

// WFS
document.getElementById("btn-load-wfs")?.addEventListener("click", () => {
    const wfsUrl = prompt("Ingrese la URL del servicio WFS:");
    if (!wfsUrl) return;

    fetch(`${wfsUrl}?service=WFS&request=GetCapabilities`)
        .then(resp => resp.text())
        .then(text => {
            const xml = new DOMParser().parseFromString(text, "text/xml");
            const layers = [...xml.getElementsByTagName("FeatureType")]?.map(l => {
                return {
                    name: l.getElementsByTagName("Name")[0]?.textContent,
                    title: l.getElementsByTagName("Title")[0]?.textContent
                }
            }).filter(l => l.name);

            if (!layers.length) return alert("No se encontraron capas WFS.");

            document.getElementById("wfs-data").innerHTML = `
                <label>Selecciona una capa:</label>
                <select id="wfs-layer-select">
                    ${layers.map(l => `<option value="${l.name}">${l.title}</option>`).join("")}
                </select>
                <button id="btn-add-wfs-layer">Cargar Capa</button>
                <button id="btn-download-wfs">Descargar GeoJSON</button>
            `;

            const wfsBox = document.getElementById("wfs-info-box");
            wfsBox.classList.remove("hidden");
            wfsBox.style.display = "block";
            

            document.getElementById("btn-add-wfs-layer").addEventListener("click", () => {
                const selected = document.getElementById("wfs-layer-select").value;
                if (!selected) return;

                const getUrl = `${wfsUrl}?service=WFS&version=1.0.0&request=GetFeature&typeName=${selected}&outputFormat=application/json`;

                fetch(getUrl)
                    .then(resp => resp.json())
                    .then(geojson => {
                        if (window.wfsLayer) map.removeLayer(window.wfsLayer);
                        window.wfsLayer = L.geoJSON(geojson, {
                            onEachFeature: (f, l) => {
                                let popup = "<b>Atributos:</b><br>";
                                for (let key in f.properties) {
                                    popup += `<b>${key}:</b> ${f.properties[key]}<br>`;
                                }
                                l.bindPopup(popup);
                            }
                        }).addTo(map);
                        map.fitBounds(window.wfsLayer.getBounds());

                        // Guardar para descarga
                        window.lastWfsData = geojson;
                    });
            });

            document.getElementById("btn-download-wfs").addEventListener("click", () => {
                if (!window.lastWfsData) return alert("No hay datos para descargar.");

                const blob = new Blob([JSON.stringify(window.lastWfsData, null, 2)], { type: "application/json" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                const fileName = document.getElementById("wfs-layer-select")?.value || "wfs_data";
                link.download = fileName + ".geojson";

                link.click();
            });
        })
        .catch(err => alert("Error al obtener WFS: " + err));
});

document.getElementById("close-wfs")?.addEventListener("click", () => {
    document.getElementById("wfs-info-box").classList.replace("show", "hidden");
    if (window.wfsLayer) map.removeLayer(window.wfsLayer);
});

// 🧲 Función para mover cuadro WFS
function makeDraggableWFS(el, headerId) {
    const header = document.getElementById(headerId);
    let offsetX = 0, offsetY = 0, isDragging = false;

    header.onmousedown = function (e) {
        isDragging = true;
        offsetX = e.clientX - el.offsetLeft;
        offsetY = e.clientY - el.offsetTop;
        document.onmousemove = function (e) {
            if (isDragging) {
                el.style.left = (e.clientX - offsetX) + "px";
                el.style.top = (e.clientY - offsetY) + "px";
                el.style.transform = "none";
            }
        };
        document.onmouseup = function () {
            isDragging = false;
            document.onmousemove = null;
            document.onmouseup = null;
        };
    };
}

// Llamar cuando se cargue el DOM
document.addEventListener("DOMContentLoaded", () => {
    const wfsBox = document.getElementById("wfs-info-box");
    makeDraggableWFS(wfsBox, "wfs-box-header");

    // Botón cerrar funcional
    document.getElementById("close-wfs")?.addEventListener("click", () => {
        wfsBox.classList.add("hidden");
        wfsBox.style.display = "none";
        if (window.wfsLayer) map.removeLayer(window.wfsLayer);
    });
});

const apiKey = "5b3ce3597851110001cf6248ce58a061df2f4960b2a4513cb3c12e65"; // 🔐 Pegá tu API key

let routeLayer;

document.getElementById("btn-directions").addEventListener("click", () => {
    const box = document.getElementById("route-box");
    box.classList.toggle("hidden");
    box.style.display = box.classList.contains("hidden") ? "none" : "block";
});

document.getElementById("btn-calc-route").addEventListener("click", async () => {
    const originInput = document.getElementById("input-origin").value.trim();
    const destInput = document.getElementById("input-dest").value.trim();
    const mode = document.getElementById("mode-select").value;

    if (!destInput) return alert("Por favor, completá el destino.");

    const getCoords = async (query) => {
        if (query.toLowerCase() === "mi ubicación") {
            return new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    pos => resolve([pos.coords.longitude, pos.coords.latitude]),
                    err => reject("No se pudo obtener ubicación")
                );
            });
        } else {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await resp.json();
            if (!data.length) throw "Dirección no encontrada";
            return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
        }
    };

    try {
        const origin = await getCoords(originInput || "mi ubicación");
        const dest = await getCoords(destInput);

        const response = await fetch(`https://api.openrouteservice.org/v2/directions/${mode}/geojson`, {
            method: "POST",
            headers: {
                "Authorization": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                coordinates: [origin, dest]
            })
        });

        const geojson = await response.json();

        if (routeLayer) map.removeLayer(routeLayer);
        routeLayer = L.geoJSON(geojson, {
            style: {
                color: "#e74c3c",
                weight: 5,
                opacity: 0.8
            }
        }).addTo(map);

        map.fitBounds(routeLayer.getBounds());

        const distKm = geojson.features[0].properties.summary.distance / 1000;
        const durMin = geojson.features[0].properties.summary.duration / 60;

        document.getElementById("route-info").innerHTML = `
            <b>Distancia:</b> ${distKm.toFixed(2)} km<br>
            <b>Duración:</b> ${durMin.toFixed(1)} min
        `;

    } catch (err) {
        console.error("Error en la ruta:", err);
        alert("No se pudo calcular la ruta.");
    }
});

