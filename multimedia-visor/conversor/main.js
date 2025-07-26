const fileInput = document.getElementById('file-input');
const out = document.getElementById('out');
const downloadLink = document.getElementById('download-link');
const modal = document.getElementById('error-modal');
const errorMsg = document.getElementById('error-msg');
const closeModal = document.getElementById('close-modal');

fileInput.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return limpiar();

  if (!file.name.endsWith('.zip')) {
    showError("Solo se admiten archivos .zip que contengan los archivos de un SHP (.shp, .dbf, .shx, etc).");
    limpiar();
    return;
  }

  out.textContent = "⏳ Leyendo y convirtiendo el archivo ZIP...";
  downloadLink.style.display = "none";

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      shp(evt.target.result)
        .then(function(geojson) {
          const geojsonStr = JSON.stringify(geojson, null, 2);
          out.textContent = geojsonStr;
          const blob = new Blob([geojsonStr], {type: "application/json"});
          downloadLink.href = URL.createObjectURL(blob);
          downloadLink.download = "convertido.geojson";
          downloadLink.style.display = "inline-block";
          downloadLink.textContent = "Descargar GeoJSON ✅";
        })
        .catch(function(e) {
          showError("❌ No se pudo leer el ZIP. ¿Seguro que es un ZIP de SHP válido?<br>Detalles: " + e);
          out.textContent = "";
          downloadLink.style.display = "none";
        });
    } catch (err) {
      showError("❌ Error inesperado: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
});

document.getElementById('btn-clear').onclick = limpiar;

function limpiar() {
  fileInput.value = '';
  out.textContent = '';
  downloadLink.style.display = "none";
}

function showError(msg) {
  errorMsg.innerHTML = msg;
  modal.style.display = 'flex';
}
closeModal.onclick = function() {
  modal.style.display = 'none';
};
window.onclick = function(event) {
  if (event.target === modal) modal.style.display = 'none';
};
