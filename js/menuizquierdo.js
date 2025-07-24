// menuizquierdo.js - VERSIÓN COMPLETA MEJORADA Y FIEL AL ORIGINAL

document.addEventListener("DOMContentLoaded", () => {
    if (!window.map) {
        window.map = L.map('map').setView([-34.60, -58.50], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(window.map);
    }

    const fabMain = document.getElementById("fab-main");
    const fabOptions = document.getElementById("fab-options");
    const options = document.querySelectorAll(".fab-option");
    const menus = document.querySelectorAll(".menu-box");
    let currentGeojsonLayer = null;

    const geojsonConfig = {
        "nbi2022.geojson": {
            attributes: ["NOMDEN", "F__NBI"],
            colorScale: ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"],
            quantiles: 5
        },
        "Area_de_estudio.geojson": {
            color: "#3182bd",
            attributes: ["OBJECTID", "Shape_Area"]
        },
        "precipitaciones.geojson": {
            attributes: ["PROV", "DPTO", "AREA_KM2", "M1_PRECIPI"],
            colorScale: ["#edf8fb", "#b2e2e2", "#66c2a4", "#2ca25f", "#006d2c"],
            quantiles: 5
        }
    };

    fabMain?.addEventListener("click", () => {
        const expanded = fabOptions.classList.toggle("show");
        fabMain.setAttribute("aria-expanded", expanded);
        menus.forEach(menu => menu.classList.remove("show"));
    });

    options.forEach(option => {
        option.addEventListener("click", function (e) {
            const menuId = this.getAttribute("data-menu");
            const menuBox = document.getElementById(menuId);
            const color = window.getComputedStyle(this).backgroundColor;
            const topic = this.innerText.trim();

            menuBox.style.backgroundColor = color;
            menuBox.querySelector(".menu-header").style.backgroundColor = color;
            menus.forEach(m => m.classList.remove("show"));
            menuBox.classList.add("show");

            const rect = this.getBoundingClientRect();
            let left = rect.right + 10;
            if (left + menuBox.offsetWidth > window.innerWidth) {
                left = rect.left - menuBox.offsetWidth - 10;
            }

            menuBox.style.top = `${rect.top + window.scrollY}px`;
            menuBox.style.left = `${left}px`;
            e.stopPropagation();

            document.dispatchEvent(new CustomEvent("syncMenuRight", { detail: { topic } }));
        });
    });

    document.body.addEventListener("click", () => menus.forEach(m => m.classList.remove("show")));
    window.addEventListener("resize", () => menus.forEach(m => m.classList.remove("show")));

    function calculateQuantiles(values, num) {
        values.sort((a, b) => a - b);
        const q = [];
        for (let i = 1; i < num; i++) {
            q.push(values[Math.floor(values.length * (i / num))]);
        }
        return q;
    }

    function createPopup(feature, config) {
        let popup = "<b>Información:</b><br>";
        config.attributes.forEach(attr => {
            popup += `<b>${attr}:</b> ${feature.properties[attr] || "N/A"}<br>`;
        });
        return popup;
    }

    document.querySelectorAll(".menu-box ul li a").forEach(link => {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            const geojsonUrl = this.getAttribute("data-geojson");
            if (!geojsonUrl) return console.warn("Falta data-geojson en el enlace");

            console.log("📥 Cargando GeoJSON:", geojsonUrl);
            if (currentGeojsonLayer) map.removeLayer(currentGeojsonLayer);

            fetch(geojsonUrl)
                .then(r => r.json())
                .then(data => {
                    const config = geojsonConfig[geojsonUrl] || { color: "#000", attributes: [] };

                    if (["nbi2022.geojson", "precipitaciones.geojson"].includes(geojsonUrl)) {
                        const attr = geojsonUrl === "nbi2022.geojson" ? "F__NBI" : "M1_PRECIPI";
                        const values = data.features.map(f => f.properties[attr]).filter(v => v !== undefined);
                        if (!values.length) return console.warn(`No se encontraron valores en ${attr}`);

                        const quantiles = calculateQuantiles(values, config.quantiles);
                        const getColor = v => {
                            if (v <= quantiles[0]) return config.colorScale[0];
                            if (v <= quantiles[1]) return config.colorScale[1];
                            if (v <= quantiles[2]) return config.colorScale[2];
                            if (v <= quantiles[3]) return config.colorScale[3];
                            return config.colorScale[4];
                        };

                        currentGeojsonLayer = L.geoJSON(data, {
                            style: f => ({
                                color: "#000",
                                weight: 1,
                                fillColor: getColor(f.properties[attr]),
                                fillOpacity: 0.7
                            }),
                            onEachFeature: (f, l) => {
                                l.on("mouseover", () => l.bindPopup(createPopup(f, config)).openPopup());
                                l.on("mouseout", () => l.closePopup());
                            }
                        }).addTo(map);
                    } else {
                        // if (config.colorScale && config.quantiles && config.attributes?.length) {
                        //     // ✔ Usar el primer atributo numérico por defecto
                        //     const atributo = config.attributes.find(attr => {
                        //         const val = data.features[0]?.properties?.[attr];
                        //         return typeof val === "number" || !isNaN(val);
                        //     });
                        
                        //     if (!atributo) return console.warn("⚠️ No hay atributos numéricos para categorizar");
                        
                        //     dibujarCapaConAtributo(data, atributo, config);
                        //     document.getElementById("atributo-select").value = atributo;
                        // } else {
                        
                        currentGeojsonLayer = L.geoJSON(data, {
                            style: { color: config.color, weight: 2 },
                            onEachFeature: (f, l) => {
                                l.on("mouseover", () => l.bindPopup(createPopup(f, config)).openPopup());
                                l.on("mouseout", () => l.closePopup());
                            }
                        }).addTo(map);
                    }

                    map.fitBounds(currentGeojsonLayer.getBounds());

                    // Guardar referencia para categorización dinámica
                    window.lastGeojsonData = data;
                    window.lastConfig = config;
                    
                    // 🧠 Poblar el selector de atributos disponibles
                    const selector = document.getElementById("atributo-select");
                    selector.innerHTML = "";
                    
                    // Mostrar solo atributos numéricos
                    const ejemplo = data.features[0]?.properties || {};
                    
                    config.attributes
                      .filter(attr => typeof ejemplo[attr] === "number" || !isNaN(ejemplo[attr]))
                      .forEach(attr => {
                          const opt = document.createElement("option");
                          opt.value = attr;
                          opt.textContent = attr;
                          selector.appendChild(opt);
                      });
                    
                    
                    
                    // 📊 Buscar el primer atributo numérico disponible y generar el gráfico
                    const primerNumerico = config.attributes.find(attr => {
                        const val = data.features[0]?.properties?.[attr];
                        return typeof val === "number" || !isNaN(val);
                    });

                    if (primerNumerico) {
                        generarGraficoPie(data, primerNumerico);
                        document.getElementById("atributo-select").value = primerNumerico;
                    }

                    

                })
                .catch(err => console.error("❌ Error cargando GeoJSON:", err));
        });
    });

    // Panel flotante
    window.togglePanel = () => {
        document.getElementById("floatingPanel")?.classList.toggle("open");
    }

    window.selectYear = el => {
        document.querySelectorAll(".year").forEach(y => y.classList.remove("selected"));
        el.classList.add("selected");
    }

    // 🗂️ Lógica para mostrar/ocultar capas por temática
const themes = {
    nbi: "nbi2022.geojson",
    precipitaciones: "precipitaciones.geojson",
    area: "Area_de_estudio.geojson"
  };
  
  const activeLayers = {};
  
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.theme;
      const url = themes[theme];
  
      if (!url) return;
  
      if (activeLayers[theme]) {
        map.removeLayer(activeLayers[theme]);
        delete activeLayers[theme];
        btn.classList.remove("active");
      } else {
        fetch(url)
          .then(resp => resp.json())
          .then(data => {
            const layer = L.geoJSON(data, {
              style: { color: "#0077be", weight: 2 },
              onEachFeature: (f, l) => {
                let popup = "<b>Atributos:</b><br>";
                for (let [k, v] of Object.entries(f.properties)) {
                  popup += `<b>${k}:</b> ${v}<br>`;
                }
                l.bindPopup(popup);
              }
            }).addTo(map);
            activeLayers[theme] = layer;
            btn.classList.add("active");
          });
      }
    });
  });
  
});

// 🧠 Redibujar capa con nuevo atributo elegido
// 📊 Solo actualizar gráfico cuando cambia el atributo
document.getElementById("atributo-select")?.addEventListener("change", function () {
    const atributo = this.value;
    if (window.lastGeojsonData && atributo) {
        generarGraficoPie(window.lastGeojsonData, atributo);
    }
});




function dibujarCapaConAtributo(geojsonData, atributo, config) {
    const valores = geojsonData.features.map(f => f.properties[atributo]).filter(v => v !== undefined && !isNaN(v));
    const quantiles = calculateQuantiles(valores, config.quantiles || 5);

    const getColor = v => {
        if (v <= quantiles[0]) return config.colorScale[0];
        if (v <= quantiles[1]) return config.colorScale[1];
        if (v <= quantiles[2]) return config.colorScale[2];
        if (v <= quantiles[3]) return config.colorScale[3];
        return config.colorScale[4];
    };

    if (window.currentGeojsonLayer) map.removeLayer(window.currentGeojsonLayer);

    window.currentGeojsonLayer = L.geoJSON(geojsonData, {
        style: f => ({
            color: "#000",
            weight: 1,
            fillColor: getColor(f.properties[atributo]),
            fillOpacity: 0.7
        }),
        onEachFeature: (f, l) => {
            l.on("mouseover", () => l.bindPopup(createPopup(f, config)).openPopup());
            l.on("mouseout", () => l.closePopup());
        }
    }).addTo(map);
    map.fitBounds(window.currentGeojsonLayer.getBounds());

    generarGraficoPie(geojsonData, atributo);
}

function generarGraficoPie(geojsonData, atributo) {
    const valores = geojsonData.features
        .map(f => f.properties[atributo])
        .filter(v => v !== undefined && v !== null && !isNaN(v));

    if (valores.length === 0) {
        console.warn("⚠️ No hay valores numéricos para graficar.");
        return;
    }

    const conteo = {};
    valores.forEach(v => {
        const clave = parseFloat(v).toFixed(2); // Agrupamos por valores redondeados
        conteo[clave] = (conteo[clave] || 0) + 1;
    });

    const etiquetas = Object.keys(conteo);
    const cantidades = Object.values(conteo);

    const colores = etiquetas.map((_, i) =>
        `hsl(${(i * 360) / etiquetas.length}, 60%, 60%)`
    );

    const ctx = document.getElementById("dataChart").getContext("2d");
    if (window.chartInstance) window.chartInstance.destroy();

    window.chartInstance = new Chart(ctx, {
        type: "pie",
        data: {
            labels: etiquetas,
            datasets: [{
                data: cantidades,
                backgroundColor: colores,
                borderWidth: 1,
                borderColor: "#fff"
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "right"
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${context.label}: ${context.raw}`;
                        }
                    }
                }
            }
        }
    });
}


// document.addEventListener("DOMContentLoaded", () => {
//     const panel = document.getElementById("panel-derecho");
//     const toggleBtn = document.getElementById("toggle-panel-derecho");

//     toggleBtn.addEventListener("click", () => {
//       panel.classList.toggle("oculto");
//       toggleBtn.textContent = panel.classList.contains("oculto") ? "▶" : "◀";
//     });
//   });


