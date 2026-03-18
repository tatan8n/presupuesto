import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';

export default function FileUpload({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSelect = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

  const handleFile = async (file) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Solo se aceptan archivos Excel (.xlsx, .xls)');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const res = await onUpload(file);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Error al cargar el archivo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
        Importar Presupuesto desde Excel
      </h2>

      {error && (
        <div className="alert alert-error">
          <AlertCircle /> {error}
        </div>
      )}

      {result && (
        <div className="alert alert-success">
          <CheckCircle /> {result.message}
        </div>
      )}

      <div
        className={`upload-zone ${isDragging ? 'active' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        id="upload-zone"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleSelect}
          style={{ display: 'none' }}
          id="file-input"
        />

        {uploading ? (
          <>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <div className="upload-text">Cargando archivo...</div>
          </>
        ) : (
          <>
            <Upload className="upload-icon" style={{ margin: '0 auto' }} />
            <div className="upload-text">
              Arrastra tu archivo Excel aquí o haz clic para seleccionar
            </div>
            <div className="upload-sub">
              Formato soportado: .xlsx — Se leerá la hoja "Detalle"
            </div>
          </>
        )}
      </div>

      {result?.summary && (
        <div className="chart-card" style={{ marginTop: 20 }}>
          <div className="chart-card-title">
            <span>Resumen de importación</span>
            <FileSpreadsheet />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total líneas</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{result.summary.totalLines}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Presupuesto total</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>
                ${(result.summary.totalBudget / 1_000_000_000).toFixed(1)}B
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Áreas</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                {Object.keys(result.summary.byArea || {}).length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
