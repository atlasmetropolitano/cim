from flask import Flask, request, send_file, jsonify
import os
import tempfile
import subprocess

app = Flask(__name__)

@app.route('/convert', methods=['POST'])
def convert():
    file = request.files['file']
    if not file:
        return jsonify({"error": "No se recibió archivo."}), 400

    with tempfile.TemporaryDirectory() as tmpdir:
        file_path = os.path.join(tmpdir, file.filename)
        file.save(file_path)
        geojson_path = os.path.join(tmpdir, 'output.geojson')

        # Comando ogr2ogr (requiere GDAL instalado)
        cmd = [
            'ogr2ogr', '-f', 'GeoJSON',
            geojson_path,
            file_path
        ]
        try:
            subprocess.check_call(cmd)
        except Exception as e:
            return jsonify({"error": f"No se pudo convertir: {e}"}), 500

        return send_file(geojson_path, as_attachment=True, download_name="convertido.geojson")

if __name__ == '__main__':
    app.run(port=5000, debug=True)
