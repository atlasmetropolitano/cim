// menudeladerecha.js - VERSIÓN COMPLETA MEJORADA Y FIEL AL ORIGINAL

if (!window.currentGeojsonLayer) {
    window.currentGeojsonLayer = null;
}

document.addEventListener("mapReady", () => {
    console.log("🟢 `map` está listo en menudeladerecha.js. Ejecutando código...");

    function selectYear(element) {
        console.log("📌 Se hizo clic en un año:", element.textContent);

        document.querySelectorAll(".year").forEach(y => y.classList.remove("selected"));
        element.classList.add("selected");

        const geojsonUrl = element.getAttribute("data-geojson");
        if (!geojsonUrl) return console.warn("⚠️ GeoJSON no definido para este año");

        console.log("🗺️ Cargando GeoJSON:", geojsonUrl);

        if (!window.map || !(window.map instanceof L.Map)) {
            console.error("🚨 `window.map` no es válido:", window.map);
            return;
        }

        if (window.lastLayer && window.map.hasLayer(window.lastLayer)) {
            window.map.removeLayer(window.lastLayer);
        }

        fetch(geojsonUrl)
            .then(r => r.json())
            .then(data => {
                if (!data.features?.length) throw new Error("GeoJSON vacío o inválido");

                const attribute = "F__NBI";
                const values = data.features.map(f => f.properties[attribute]).filter(v => !isNaN(v));
                if (!values.length) return console.warn("⚠️ Sin valores válidos en", attribute);

                const quantiles = calculateQuantiles(values, 5);

                function getColor(value) {
                    if (value <= quantiles[0]) return "#fee5d9";
                    if (value <= quantiles[1]) return "#fcae91";
                    if (value <= quantiles[2]) return "#fb6a4a";
                    if (value <= quantiles[3]) return "#de2d26";
                    return "#a50f15";
                }

                window.lastLayer = L.geoJSON(data, {
                    style: f => ({
                        color: "#000",
                        weight: 1,
                        fillColor: getColor(f.properties[attribute]),
                        fillOpacity: 0.7
                    }),
                    onEachFeature: (f, l) => {
                        let content = "<b>Información:</b><br>";
                        for (const [k, v] of Object.entries(f.properties)) {
                            content += `<b>${k}:</b> ${v}<br>`;
                        }
                        l.bindPopup(content);
                    }
                });

                window.lastLayer.addTo(window.map);
                window.map.fitBounds(window.lastLayer.getBounds());

                updateInfoPanel(data, element.textContent, quantiles);
            })
            .catch(err => console.error("🚨 Error cargando GeoJSON:", err));
    }

    function updateInfoPanel(data, year, quantiles) {
        console.log("🔍 Actualizando panel para:", year);

        const attribute = "F__NBI";
        const values = data.features.map(f => f.properties[attribute]).filter(v => !isNaN(v));
        if (!values.length) return console.warn("⚠️ Sin valores válidos para", attribute);

        document.querySelector(".density-list").innerHTML = `
            <h2>Necesidades Básicas Insatisfechas</h2>
            <ul>
                <li><span class="icon" style="background:${getColor(quantiles[0], quantiles)}"></span> Menor a ${quantiles[0].toFixed(2)}</li>
                <li><span class="icon" style="background:${getColor(quantiles[1], quantiles)}"></span> ${quantiles[0].toFixed(2)} a ${quantiles[1].toFixed(2)}</li>
                <li><span class="icon" style="background:${getColor(quantiles[2], quantiles)}"></span> ${quantiles[1].toFixed(2)} a ${quantiles[2].toFixed(2)}</li>
                <li><span class="icon" style="background:${getColor(quantiles[3], quantiles)}"></span> ${quantiles[2].toFixed(2)} a ${quantiles[3].toFixed(2)}</li>
                <li><span class="icon" style="background:${getColor(quantiles[3] + 1, quantiles)}"></span> Mayor a ${quantiles[3].toFixed(2)}</li>
            </ul>
        `;
    }

    function calculateQuantiles(values, count) {
        values.sort((a, b) => a - b);
        const q = [];
        for (let i = 1; i < count; i++) {
            q.push(values[Math.floor(values.length * (i / count))]);
        }
        return q;
    }

    function getColor(value, q) {
        if (value <= q[0]) return "#fee5d9";
        if (value <= q[1]) return "#fcae91";
        if (value <= q[2]) return "#fb6a4a";
        if (value <= q[3]) return "#de2d26";
        return "#a50f15";
    }

    document.querySelectorAll(".year").forEach(year => {
        year.addEventListener("click", function () {
            selectYear(this);
        });
    });

   // 🚫 Eliminado autoload de GeoJSON en inicio
// const selectedYear = document.querySelector(".year.selected");
// if (selectedYear) {
//     console.log("📌 Año activo:", selectedYear.textContent);
//     selectYear(selectedYear);
// }

});

function updateInfo(year) {
    const data = {
        "2001": { "Habitantes": 3626932, "Hogares": 17860, "Área (km²)": 13916.94 },
        "2010": { "Habitantes": 4368374, "Hogares": 17860, "Área (km²)": 13916.94 },
        "2022": { "Habitantes": 5434762, "Hogares": 17860, "Área (km²)": 13916.94 }
    };

    if (data[year]) {
        document.querySelector(".stats p:nth-child(2)").innerHTML = `<strong>Habitantes:</strong> ${data[year].Habitantes.toLocaleString()}`;
        document.querySelector(".stats p:nth-child(3)").innerHTML = `<strong>Hogares:</strong> ${data[year].Hogares.toLocaleString()}`;
        document.querySelector(".stats p:nth-child(4)").innerHTML = `<strong>Área:</strong> ${data[year]["Área (km²)"].toLocaleString()} km²`;
    }
}

document.querySelectorAll(".year").forEach(button => {
    button.addEventListener("click", function() {
        const year = this.getAttribute("data-geojson")?.match(/(\d{4})/)[0];
        updateInfo(year);
    });

    document.addEventListener("syncMenuRight", (event) => {
        const topic = event.detail.topic;
        const titleEl = document.getElementById("menu-right-title");
        if (titleEl) {
            titleEl.innerText = topic;
            console.log(`✅ Menú derecho actualizado: ${topic}`);
        }
    });
});

