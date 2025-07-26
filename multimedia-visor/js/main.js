// Inicializar Leaflet
const map = L.map('map').setView([-34.60, -58.50], 11);

// --- Mapas base ---
let osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '&copy; OpenStreetMap contributors'});
let gmapLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {attribution: '&copy; Google'});
let gsatLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {attribution: '&copy; Google'});

osmLayer.addTo(map);

const baseLayers = {
  "osm": osmLayer,
  "gmap": gmapLayer,
  "gsat": gsatLayer
};
let currentBase = "osm";

function setBaseMap(layerKey) {
  if (baseLayers[layerKey] && layerKey !== currentBase) {
    map.removeLayer(baseLayers[currentBase]);
    baseLayers[layerKey].addTo(map);
    currentBase = layerKey;
  }
}

// FAB mapas base
const baseMapFab = document.getElementById("baseMapFab");
const baseMapOptions = document.getElementById("baseMapOptions");
baseMapFab.onclick = (e) => {
  e.stopPropagation();
  baseMapOptions.style.display = baseMapOptions.style.display === "none" ? "flex" : "none";
};
baseMapOptions.querySelectorAll("button").forEach(btn => {
  btn.onclick = () => {
    setBaseMap(btn.dataset.layer);
    baseMapOptions.style.display = "none";
  };
});
document.addEventListener("click", e => {
  if (!baseMapOptions.contains(e.target) && e.target !== baseMapFab) {
    baseMapOptions.style.display = "none";
  }
});

// ---- MODALES MULTIMEDIA ----
const modal = document.getElementById('mediaModal');
const overlay = document.getElementById('overlay');

function closeModal() {
  modal.classList.add('hidden');
  overlay.classList.add('hidden');
  modal.innerHTML = '';
}
overlay.onclick = closeModal;

function showModal(type, url) {
  let content = '';
  if (type === 'audio') {
    content = `<div class="modal-title">🎧 Audio asociado</div>
      <audio controls autoplay>
        <source src="${url}" type="audio/mp3">Tu navegador no soporta audio.
      </audio>`;
  }
  if (type === 'video') {
    content = `<div class="modal-title">🎬 Video asociado</div>
      <video controls autoplay>
        <source src="${url}" type="video/mp4">Tu navegador no soporta video.
      </video>`;
  }
  if (type === 'img') {
    content = `<div class="modal-title">🖼️ Imagen asociada</div>
      <img src="${url}" alt="Imagen asociada">`;
  }
  modal.innerHTML = `
    <button class="close-modal" title="Cerrar" onclick="closeModal()">✖</button>
    ${content}
  `;
  modal.classList.remove('hidden');
  overlay.classList.remove('hidden');
}
window.closeModal = closeModal;

function showMediaChooser(props) {
  let opts = [];
  if (props.audio_url) opts.push({type: 'audio', label: '🎧 Audio', url: props.audio_url});
  if (props.video_url) opts.push({type: 'video', label: '🎬 Video', url: props.video_url});
  if (props.img_url)   opts.push({type: 'img',   label: '🖼️ Imagen', url: props.img_url});

  if (opts.length === 0) {
    modal.innerHTML = `
      <button class="close-modal" title="Cerrar" onclick="closeModal()">✖</button>
      <div class="modal-title">No hay multimedia en esta entidad.</div>`;
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
    return;
  }
  if (opts.length === 1) {
    showModal(opts[0].type, opts[0].url);
    return;
  }

  let btns = opts.map(opt => 
    `<button onclick="showModal('${opt.type}','${opt.url.replace(/'/g,"\'")}')">${opt.label}</button>`
  ).join("");
  modal.innerHTML = `
    <button class="close-modal" title="Cerrar" onclick="closeModal()">✖</button>
    <div class="modal-title">Seleccioná qué multimedia querés ver:</div>
    <div class="modal-btns">${btns}</div>
  `;
  modal.classList.remove('hidden');
  overlay.classList.remove('hidden');
}
window.showModal = showModal;

// --- CARGA DE ARCHIVO (GEOJSON / ZIP) ---
let userLayer = null;
function tieneCamposMultimedia(features) {
  if (!features || !features.length) return false;
  const prop = features[0].properties;
  return ['audio_url','video_url','img_url'].every(f => Object.keys(prop).includes(f));
}

function handleGeoJSON(geojson) {
  if (userLayer) map.removeLayer(userLayer);
  if (!geojson.features || !geojson.features.length) {
    alert("❌ El archivo no contiene entidades.");
    return;
  }
  if (!tieneCamposMultimedia(geojson.features)) {
    alert("⚠️ El archivo no tiene los campos multimedia requeridos: 'audio_url', 'video_url', 'img_url'.");
  }
  userLayer = L.geoJSON(geojson, {
    onEachFeature: (feature, layer) => {
      layer.on('click', function() {
        if (tieneCamposMultimedia([feature])) {
          showMediaChooser(feature.properties);
        } else {
          modal.innerHTML = `<button class="close-modal" title="Cerrar" onclick="closeModal()">✖</button>
          <div class="modal-title">Esta entidad no tiene multimedia disponible.</div>`;
          modal.classList.remove('hidden');
          overlay.classList.remove('hidden');
        }
      });
    },
    style: { color: "#ca7d3d", weight: 2, fillOpacity: 0.3 }
  }).addTo(map);
  try { map.fitBounds(userLayer.getBounds()); } catch (e) {}
}

document.getElementById('file-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.name.endsWith('.geojson')) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const geojson = JSON.parse(evt.target.result);
      handleGeoJSON(geojson);
    };
    reader.readAsText(file);
  }
});

// Mostrar el modal solo si no se aceptó antes
window.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("geojson-warning");
  if (modal && !localStorage.getItem("advertenciaMultimediaAceptada")) {
    modal.style.display = "flex";
  }
});

function cerrarAdvertencia() {
  // localStorage.setItem("advertenciaMultimediaAceptada", "true");
  const modal = document.getElementById("geojson-warning");
  if (modal) modal.remove();
}


