
# PBIP Lens 🔍

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-007ACC.svg)
![Status: Production Ready](https://img.shields.io/badge/Status-v0.1.2--Stable-green.svg)

**PBIP Lens** es una herramienta de análisis de impacto y dependencias estáticas para archivos de proyectos de Power BI (`.pbip`, `.tmdl`, `.pbir`).

Diseñada para desarrolladores y arquitectos de datos, PBIP Lens se integra directamente en VS Code para responder a la pregunta más aterradora en el desarrollo de Power BI: *"¿Es seguro borrar esta medida o columna?"*

## ⚠️ El Problema

A medida que los modelos de Power BI crecen, se llenan de medidas "zombies" y columnas heredadas. Limpiar el modelo es riesgoso porque una simple eliminación puede romper visuales en páginas ocultas, invalidar medidas DAX anidadas o destruir relaciones del modelo. La falta de visibilidad genera parálisis y modelos inflados.

## 💡 La Solución

PBIP Lens actúa como un escáner de rayos X local para tu proyecto. Analiza la gramática DAX y la estructura JSON de tus reportes para trazar un mapa de dependencias exacto, sin necesidad de conectarse a la nube ni a la API de Power BI. Todo ocurre localmente en tu editor.

## ✨ Características Principales

### 1. Explorador de Medidas (Measure Explorer)

Identifica instantáneamente qué medidas están sosteniendo tu reporte y cuáles son peso muerto.

* **✅ En Uso:** Medidas detectadas dentro de las estructuras JSON de los visuales del reporte (incluso en formatos dinámicos y títulos).
* **⚠️ Huérfanas:** Medidas definidas en el modelo que no tienen ningún impacto visual en el reporte actual.
* **Grafo de Dependencias DAX:** Despliega cualquier medida para ver su linaje (`Usa a` / `Usada por`). Si una medida no está en un visual, pero alimenta a una medida superior, el árbol de dependencias te avisará antes de que cometas un error.

### 2. Auditoría Quirúrgica de Columnas (Tables Explorer)

No evalúes las columnas solo por su uso visual. PBIP Lens realiza un escaneo de 5 frentes de seguridad antes de sugerir que una columna es prescindible. Genera un reporte detallado en Markdown evaluando:

* 📊 Uso en visuales del PBIX.
* 🧮 Referencias en código DAX (Medidas, Columnas Calculadas).
* 🔗 Uso como Llave de Relación (Primary/Foreign Key).
* 🔀 Uso como objetivo de ordenamiento (*Sort-By Target*).
* 🔐 Implicaciones en la Seguridad a Nivel de Fila (RLS).

### 3. Navegación Nativa

Haz clic en cualquier medida o columna en el explorador y PBIP Lens abrirá instantáneamente el archivo `.tmdl` correspondiente, llevándote directo al código fuente para auditarlo o editarlo.

## 🚀 Uso Rápido

1. Abre la carpeta raíz de tu proyecto Power BI (`.pbip`) en VS Code.
2. Abre la barra lateral de PBIP Lens (icono de base de datos).
3. La extensión escaneará automáticamente la carpeta en busca de la definición del modelo (`.SemanticModel`) y el reporte (`.Report`).
4. Navega por el árbol para explorar el linaje o haz clic en cualquier elemento para abrir su código fuente o su perfil de auditoría detallado.

## 🛠️ Arquitectura y Privacidad

PBIP Lens prioriza la velocidad y la seguridad corporativa:

* **100% Local:** No se envían datos, esquemas ni código DAX a servidores externos.
* **Escaneo Estructural:** A diferencia de las búsquedas de texto plano (que generan falsos positivos), el motor parsea profundamente las estructuras anidadas de los nuevos formatos `.pbir` y los archivos JSON de los visuales.

## ⚙️ Bajo el Capó (Under the Hood)

PBIP Lens no es un simple buscador de texto (`Ctrl+F`). Su motor de auditoría utiliza:

* **Analizador Estático de TMDL:** Un parser robusto que interpreta la jerarquía de objetos y extrae definiciones DAX limpias (remanejando comentarios y metadatos).
* **Motor de Grafos BFS (Breadth-First Search):** Las dependencias se calculan mediante un algoritmo de búsqueda en anchura. Si una Columna alimenta a la Medida A, y la Medida A alimenta a la Medida B la cual está en un visual, PBIP Lens marcará la Columna como "En Uso" automáticamente.
* **Mapeo de Layout de Reporte:** Lee la configuración del archivo `visual.json` para identificar enlaces directos y ocultos en el diseño del informe.

## 🛣️ Limitaciones Conocidas (Roadmap)

* Actualmente, el escáner se centra en proyectos que utilizan el formato *Tabular Model Definition Language* (TMDL).
* La detección de uso en visuales de terceros (Custom Visuals) con estructuras JSON no estándar puede requerir validación manual.

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.
