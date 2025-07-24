# Conversor web SHP/ZIP a GeoJSON

## Requisitos

- Python 3
- Flask (`pip install Flask`)
- GDAL (ogr2ogr) instalado en el sistema (https://gdal.org/download.html)
  - Verificá con: ogr2ogr --version

## Uso

1. Iniciá el servidor Flask:
   python server.py

2. Abrí index.html en un navegador (preferentemente desde un servidor local, o usá Live Server de VSCode).

3. Subí tu archivo .geojson, .shp o .zip.

4. Si subís un .shp o .zip, aparecerá una ventana para convertirlo a GeoJSON.
   Al aceptar, se envía al servidor, se convierte y se descarga el archivo listo.

---

*Si no tenés GDAL, instalalo según tu sistema operativo (ver https://gdal.org/download.html)*
