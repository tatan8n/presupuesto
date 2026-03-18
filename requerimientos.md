# Documento de Requerimientos – Aplicación de Control Presupuestario 2026

## 1. Contexto y objetivo

La empresa cuenta con un archivo Excel que contiene el presupuesto completo del año 2026, organizado principalmente en una hoja maestra llamada `detalle`. Este archivo incluye, además, otras hojas con tablas dinámicas, gráficos e indicadores que ya se usan para análisis financieros internos (por línea de negocio, por área, nómina, inversión, etc.) [web:23][web:24].

El objetivo es construir una **aplicación de control presupuestario** que:

- Use una base de datos en **Supabase (PostgreSQL)** como fuente de datos principal y fuente de verdad.
- Permita la **carga inicial** y **exportación** del presupuesto hacia/desde el archivo Excel heredado.
- Permita **editar el presupuesto** (crear/editar/eliminar líneas) directamente desde la aplicación.
- Reciba los **gastos reales** desde el ERP Dolibarr (facturas de proveedor / órdenes de compra) y los asocie a líneas de presupuesto.
- Muestre indicadores y visualizaciones dinámicas (presupuesto vs ejecutado, por área, línea, escenario, etc.), incluyendo un **flujo semanal estimado** de ejecución [web:20][web:23][web:24].

---

## 2. Fuentes de datos y estructura

### 2.1. Archivo maestro de presupuesto (Excel)

- Formato: archivo Excel (`.xlsx`).
- Hoja maestra: `detalle` (es la “base de datos” principal).
- Otras hojas: contienen tablas dinámicas, gráficos e indicadores derivados del presupuesto (no son la fuente maestra, pero pueden reutilizarse) [web:23][web:24].

### 2.2. Estructura real de la hoja `detalle`

Cada fila representa una **línea de presupuesto**. Los nombres de las columnas son exactamente los siguientes:

- `Cuenta`
- `Cuenta contable`
- `Área`
- `Nombre del elemento`
- `Escenario`
- `Fecha`
- `Enero`
- `Febrero`
- `Marzo`
- `Abril`
- `Mayo`
- `Junio`
- `Julio`
- `Agosto`
- `Septiembre`
- `Octubre`
- `Noviembre`
- `Diciembre`
- `Total`
- `ICGI`
- `% Mat, CIF, com`
- `Línea`

La aplicación debe usar estos nombres de columna como referencia por defecto, pero debe permitir configurar un **mapeo de columnas** en caso de cambios futuros [web:23][web:24].

---

## 3. Integración con ERP Dolibarr

### 3.1. Objetivo de la integración

- Cada **factura de proveedor** y/o **orden de compra** generada en Dolibarr debe poder vincularse a una **línea del presupuesto** (fila de la hoja `detalle`).
- Esta vinculación permitirá:
  - Acumular el **gasto ejecutado** por línea de presupuesto.
  - Calcular el **saldo disponible** por línea, área, `Línea`, tipo de gasto y escenario [web:21][web:25].

### 3.2. Mecanismo de vinculación

- En Dolibarr se dispondrá de un **campo adicional** (por ejemplo, `id_linea_presupuesto`) en:
  - Facturas de proveedor.
  - Órdenes de compra.
- Ese campo almacenará el identificador único de la línea de presupuesto (`id_linea`) definida en la hoja `detalle`.
- La aplicación debe poder **leer** las facturas / órdenes desde la API de Dolibarr y mapearlas a las líneas presupuestales usando este campo [web:15][web:17][web:22].

### 3.3. Requerimientos técnicos de la API Dolibarr

- Uso del **módulo REST API** de Dolibarr activado y configurado [web:15][web:17][web:22].
- Autenticación:
  - Uso de **API key** enviada en el header `DOLAPIKEY: <api_key>` [web:15][web:17].
- Formato:
  - Peticiones HTTP estándar (GET, POST, PUT, DELETE) con datos en JSON [web:9][web:17].
- Endpoints típicos a usar (ejemplos):
  - Listar facturas de proveedor.
  - Obtener detalle de una factura de proveedor.
  - Listar órdenes de compra.
  - Obtener detalle de una orden de compra.
- La aplicación debe:
  - Permitir configurar la **URL base** de la API de Dolibarr.
  - Permitir configurar el **API key** y guardarlo de forma segura.
  - Definir reglas para:
    - Incluir solo facturas/órdenes de 2026.
    - Considerar solo documentos con estados específicos (aprobado, validado, facturado, etc.) [web:15][web:17].

---

## 4. Modelo de datos lógico (aplicación)

### 4.1. Entidad: Línea de Presupuesto

Además de las columnas reales, la aplicación manejará campos internos:

- `id_linea` (string o número, interno de la aplicación).
- `Cuenta`
- `Cuenta contable`
- `Área`
- `Nombre del elemento`
- `Escenario` (1/2/3, donde 1 = prioridad alta / se ejecuta sí o sí).
- `Fecha` (nullable).
- `Enero` … `Diciembre` (12 columnas de monto mensual).
- `Total` (suma de los 12 meses; puede recalcularse).
- `ICGI` (campo informativo/indicador, se respeta tal cual viene del Excel).
- `% Mat, CIF, com` (porcentaje o indicador usado en el modelo actual).
- `Línea` (línea de negocio).
- `ejecutado_acumulado` (campo calculado en la aplicación a partir de Dolibarr).
- `saldo` = `Total` − `ejecutado_acumulado`.
- `estado` (activa/inactiva).
- `observaciones` (opcional, solo en la aplicación).

### 4.2. Entidad: Movimiento Real (Gasto / Ejecución)

Derivado de Dolibarr:

- `id_movimiento` (id de la factura/orden o combinación).
- `id_linea_presupuesto` (clave que lo vincula a la línea de presupuesto).
- `fecha_documento`
- `tipo_documento` (factura proveedor, orden de compra).
- `proveedor`
- `monto`
- `moneda` (si aplica).
- `estado_documento` (validado, pagado, etc.).

---

## 5. Funcionalidades de la aplicación

### 5.1. Carga y sincronización de datos

1. **Carga inicial de presupuesto desde Excel**
   - Seleccionar archivo Excel.
   - Seleccionar hoja maestra `detalle`.
   - Detectar automáticamente las columnas listadas arriba; si hay cambios, permitir configurar un mapeo.
   - Importar y mostrar un resumen (número de líneas, total por `Área`, `Línea`, `Escenario`, tipo, etc.) [web:23][web:24].

2. **Sincronización con Excel**
   - Opción para **actualizar** datos desde el Excel manteniendo:
     - El `id_linea` como identificador constante.
     - Los montos (`Enero`–`Diciembre`) y descripciones (`Nombre del elemento`, `Cuenta`, `Cuenta contable`, `Área`, `Línea`) actualizados.
   - Evitar duplicar líneas si ya existen con el mismo `id_linea`.

3. **Sincronización con Dolibarr**
   - Configurar parámetros de conexión (URL, API key, filtros de fecha/estado).
   - Botón de “Sincronizar movimientos” que:
     - Obtiene facturas y órdenes de compra.
     - Identifica el campo `id_linea_presupuesto`.
     - Acumula el monto ejecutado por `id_linea`.
   - Guardar log de sincronización (fecha, número de documentos nuevos/leídos) [web:15][web:17].

---

### 5.2. Edición del presupuesto (CRUD)

La aplicación debe permitir **gestionar completamente las líneas de presupuesto**, en una interfaz tipo tabla basada directamente en las columnas reales.

- **Crear nueva línea**:
  - Completar datos obligatorios: `Cuenta`, `Cuenta contable`, `Área`, `Nombre del elemento`, `Escenario`, `Línea`.
  - Asignar distribución de montos en `Enero`–`Diciembre` (manual o replicar de otro registro / distribuir automáticamente).
  - La aplicación calcula `Total` como suma de `Enero`–`Diciembre`.
  - Permitir opcionalmente diligenciar `ICGI` y `% Mat, CIF, com`.

- **Editar línea existente**:
  - Modificar cualquier campo (excepto `id_linea`, interno).
  - Recalcular `Total` de acuerdo con los cambios en `Enero`–`Diciembre`.
  - Mantener la relación con movimientos ejecutados (no se debe romper el vínculo si se cambian textos descriptivos).

- **Eliminar línea**:
  - Opción de eliminación lógica (`estado = inactiva`) para no perder históricos.
  - Opción de eliminación física solo si no hay movimientos vinculados.

- **Guardar cambios en Excel**:
  - La aplicación debe poder **escribir** nuevamente sobre la hoja `detalle`:
    - Actualizar columnas reales (`Cuenta`, `Cuenta contable`, `Área`, etc.).
    - Insertar nuevas filas para líneas nuevas.
    - Marcar de alguna forma las líneas inactivas (por ejemplo, columna adicional o convención) si se decide.

---

### 5.3. Visualizaciones e indicadores

La aplicación debe ofrecer un módulo de reportes interactivos con filtros y gráficos dinámicos [web:20][web:23][web:24].

#### 5.3.1. Filtros globales

- Año (2026, idealmente parametrizable).
- `Área`.
- `Línea` (línea de negocio).
- `Escenario` (1, 2, 3).
- Tipo (derivado del modelo actual: inversión, costo, gasto, ingreso; si se maneja como agrupación de `Cuenta` / `Cuenta contable`).
- Rango de fechas.
- Estado de ejecución (sin ejecución, parcialmente ejecutado, ejecutado al 100%, sobre-ejecutado).

#### 5.3.2. Indicadores clave (KPIs)

- Presupuesto total (suma de `Total`).
- Total ejecutado (suma de `ejecutado_acumulado`).
- Saldo total disponible (`Total` − `ejecutado_acumulado`).
- % de ejecución global.
- % de ejecución por:
  - `Área`.
  - `Línea`.
  - `Escenario`.
  - Tipo (inversión/costo/gasto/ingreso, si se clasifica) [web:20][web:23].

#### 5.3.3. Gráficos sugeridos

- **Presupuesto vs ejecutado**:
  - Por `Área`.
  - Por `Línea`.
  - Por tipo.
- **Ejecución temporal**:
  - Por mes (usando `Enero`–`Diciembre` vs montos ejecutados por fecha de documento).
  - Por semana (ver sección 5.4).
- **Distribución del presupuesto**:
  - Gráficos de barras o de torta por `Área`, `Línea`, `Escenario`, tipo [web:20][web:23][web:24].

---

### 5.4. Flujo de caja semanal estimado

El sistema debe poder visualizar el presupuesto (y su ejecución) en una vista **semanal**:

1. **Regla general de distribución**:
   - Para cada línea:
     - Determinar en qué meses tiene valores en `Enero`–`Diciembre`.
     - Para cada mes con valor:
       - Si la columna `Fecha` está diligenciada:
         - Asignar el monto de ese mes a la semana del año que contiene dicha fecha.
       - Si la columna `Fecha` está vacía:
         - Asumir que la ejecución es al **final del mes** y asignar el monto a la última semana de ese mes.
   - En líneas con valores en todos los meses, aplicar la regla anterior mes a mes.

2. **Configurabilidad futura**:
   - En fases posteriores se puede:
     - Permitir distribución uniforme del monto mensual entre todas las semanas del mes.
     - Permitir distribución personalizada mediante porcentajes.

3. **Salida**:
   - Tabla y gráficos de flujo semanal:
     - Semanas 1 a 52 del año.
     - Monto presupuestado por semana.
     - Monto ejecutado por semana (según `fecha_documento` de la factura/orden).
   - Posibilidad de agrupar por `Área`, `Línea`, tipo.

---

## 6. Requisitos no funcionales

- **Tecnología sugerida (flexible)**:
  - Frontend: React, Vue o similar, con componentes de tabla y gráficos interactivos.
  - Backend: Node.js / Python (Flask/FastAPI) o similar, que:
    - Lea/escriba el archivo Excel con las columnas reales.
    - Se conecte a la API REST de Dolibarr.
  - Manejo de Excel: librerías tipo `xlsx` (Node) o `openpyxl`/`pandas` (Python) [web:23][web:24].

- **Persistencia**:
  - **Supabase (PostgreSQL)** será la **fuente de verdad** persistente para las líneas de presupuesto.
  - El Excel (hoja `detalle`) se usará exclusivamente para la importación inicial de datos o para la exportación de respaldos.
  - La aplicación consultará de manera dinámica la base de datos para todas las operaciones analíticas y de reportería.

- **Rendimiento**:
  - El tamaño de la hoja `detalle` es limitado (no crecerá mucho), por lo que se espera un rendimiento adecuado con carga en memoria.
  - Tiempo de carga del archivo Excel y generación de vistas debe ser razonable (menos de ~5–10 segundos en escenarios típicos) [web:23][web:24].

- **Seguridad**:
  - Proteger el API key de Dolibarr, no exponerlo en el frontend.
  - Autenticación básica de usuarios de la aplicación (usuario/contraseña o SSO en el futuro).

---

## 7. Casos de uso

### CU1 – Carga inicial del presupuesto

1. El usuario abre la aplicación.
2. Sube el archivo Excel que contiene el presupuesto 2026.
3. Selecciona la hoja `detalle`.
4. La aplicación reconoce las columnas `Cuenta`, `Cuenta contable`, `Área`, etc.
5. Importa las líneas y muestra un resumen global.

### CU2 – Vinculación de facturas de proveedor

1. El usuario configura la URL y API key de Dolibarr.
2. Define filtros (año 2026, estados de documento).
3. Ejecuta la sincronización.
4. La aplicación consulta facturas y órdenes en Dolibarr [web:15][web:17].
5. Usa el campo `id_linea_presupuesto` para asociar cada documento a una línea de la hoja `detalle`.
6. Calcula el ejecutado por línea y actualiza los saldos.

### CU3 – Edición de una línea de presupuesto

1. El usuario filtra por `Área` y/o `Línea`.
2. Selecciona una línea específica.
3. Modifica `Nombre del elemento`, `Escenario` y algunos montos mensuales (`Enero`, `Febrero`, etc.).
4. Guarda cambios.
5. La aplicación recalcula `Total` y actualiza la hoja `detalle` si se activa escritura.

### CU4 – Alta de nueva línea de presupuesto

1. El usuario presiona “Agregar línea”.
2. Diligencia `Cuenta`, `Cuenta contable`, `Área`, `Nombre del elemento`, `Escenario`, `Línea`, montos de `Enero`–`Diciembre`.
3. La aplicación genera un `id_linea` único interno.
4. La línea se agrega a la tabla y, al guardar, a la hoja `detalle`.

### CU5 – Análisis de ejecución semanal

1. El usuario abre la vista de flujo semanal.
2. Selecciona filtros por `Línea` o `Área`.
3. La aplicación:
   - Calcula la distribución semanal del presupuesto usando la columna `Fecha` y las reglas definidas.
   - Muestra un gráfico con presupuesto vs ejecutado por semana.
4. El usuario identifica semanas críticas de flujo de caja.

### CU6 – Seguimiento por escenario de prioridad

1. El usuario filtra `Escenario = 1`.
2. Observa para esas líneas:
   - Presupuesto total (`Total`).
   - Ejecutado acumulado.
   - Saldo y % de ejecución.
3. Toma decisiones sobre la ejecución de líneas con `Escenario` 2 y 3.

---

## 8. Fases de implementación sugeridas

### Fase 1 – MVP

- Importar Excel y leer hoja `detalle` con las columnas reales.
- Mostrar tabla con filtros básicos por `Área`, `Línea`, `Escenario`.
- Configurar conexión a Dolibarr y leer facturas/órdenes (solo lectura).
- Calcular ejecutado por línea y saldos.
- Gráficos básicos de presupuesto vs ejecutado por mes [web:20][web:23][web:24].

### Fase 2 – Análisis avanzado

- Agregar vistas e indicadores por `Área`, `Línea`, `Escenario` y tipo.
- Implementar flujo semanal.
- Mejorar filtros y opciones de exportación (por ejemplo, exportar a Excel/CSV).

### Fase 3 – Edición avanzada y escritura en Excel

- CRUD completo de líneas desde la aplicación.
- Escritura controlada sobre la hoja `detalle`, manteniendo los nombres de columna reales.
- Manejo de versiones del archivo (backup antes de sobrescribir).

---

## 9. Entregables esperados

- Código fuente de la aplicación (frontend + backend).
- Documentación de despliegue y configuración.
- Manual de usuario con:
  - Proceso de carga del Excel y explicación de cada columna (`Cuenta`, `Cuenta contable`, etc.).
  - Configuración de Dolibarr.
  - Uso de vistas, filtros y reportes.
- Scripts o mecanismos para lectura/escritura segura del archivo Excel.
