const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const budgetRoutes = require('./controllers/budgetController');
const budgetService = require('./services/BudgetService');

const app = express();

// Configuración de directorio de uploads (Vercel usa /tmp para escritura)
const isVercel = process.env.VERCEL || process.env.NOW_BUILDER || process.env.NODE_ENV === 'production';
const uploadsDir = isVercel 
  ? '/tmp' 
  : path.join(__dirname, '..', 'uploads');

if (!isVercel && !fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    console.warn(`⚠️ No se pudo crear el directorio de uploads local: ${err.message}`);
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas API
app.use('/api/budget', budgetRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL
  });
});

// Servir frontend estático SOLO en desarrollo local
// En Vercel, esto es gestionado por el capa estática (vercel.json rewrites)
if (!isVercel) {
  const frontendBuild = path.join(__dirname, '..', 'frontend', 'dist');
  if (fs.existsSync(frontendBuild)) {
    app.use(express.static(frontendBuild));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(frontendBuild, 'index.html'));
      }
    });
  }
}

// Iniciar servidor solo si no estamos en Vercel
if (!isVercel) {
  const PORT = config.port || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor de presupuesto ejecutándose en http://localhost:${PORT}`);
  });
}

module.exports = app;
