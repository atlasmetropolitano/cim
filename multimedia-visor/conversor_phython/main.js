// Carga del archivo
document.getElementById('file-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const ext = file.name.toLowerCase().split('.').pop();

  if (ext === 'geojson') {
    // Leer y mostrar GeoJSON directamente
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const geojson = JSON.parse(evt.target.result);
        document.getElementById('out').textContent = JSON.stringify(geojson, null, 2);
      } catch (err) {
        document.getElementById('out').textContent = "❌ GeoJSON inválido.";
      }
    };
    reader.readAsText(file);
  } else if (ext === 'zip' || ext === 'shp') {
    mostrarModalConvertir(file);
  } else {
    document.getElementById('out').textContent = "❌ Formato no soportado.";
  }
});

function mostrarModalConvertir(file) {
  const modal = document.getElementById('convert-modal');
  modal.style.display = 'flex';

  document.getElementById('btn-convertir').onclick = () => {
    modal.style.display = 'none';
    convertirArchivo(file);
  };
  document.getElementById('btn-cancelar').onclick = () => {
    modal.style.display = 'none';
    document.getElementById('file-input').value = '';
  };
}

function convertirArchivo(file) {
  const out = document.getElementById('out');
  out.textContent = "⏳ Convirtiendo archivo, espere...";
  const formData = new FormData();
  formData.append('file', file);

  fetch('http://localhost:5000/convert', {
    method: 'POST',
    body: formData
  })
  .then(res => {
    if (!res.ok) throw new Error('Error en la conversión');
    return res.blob();
  })
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    out.textContent = "✅ ¡Conversión exitosa! Descargando GeoJSON...";
    // Descargar automáticamente el GeoJSON convertido
    const a = document.createElement('a');
    a.href = url;
    a.download = 'convertido.geojson';
    document.body.appendChild(a);
    a.click();
    a.remove();
  })
  .catch(e => {
    out.textContent = "❌ No se pudo convertir: " + e;
  });
}

function limpiar() {
  document.getElementById('file-input').value = '';
  document.getElementById('out').textContent = '';
}
