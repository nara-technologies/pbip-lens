# PBIP Lens

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-007ACC.svg)
![Status: Production Ready](https://img.shields.io/badge/Status-v0.1.3--Stable-green.svg)

**PBIP Lens** es un Linter de Arquitectura y Analizador Estatico Avanzado diseñado para proyectos de desarrollo de Power BI (.pbip, .tmdl, .pbir).

Desarrollado para Arquitectos de Datos y Desarrolladores de Business Intelligence, PBIP Lens se integra directamente en Visual Studio Code para auditar la integridad del modelo semantico, mapear linajes complejos y validar politicas de gobernanza. Mediante un motor de analisis desacoplado y extensible, la herramienta ayuda a reducir la deuda tecnica y garantizar la estabilidad de los reportes antes de cada despliegue.

## El Desafio en Enterprise BI

A medida que los modelos de datos crecen en entornos corporativos, acumulan medidas obsoletas, columnas sin documentar y violaciones de diseño. Eliminar o modificar estos elementos conlleva un alto riesgo de rotura en reportes visuales o dependencias anidadas en DAX. PBIP Lens mitiga este riesgo transformando el codigo fuente del proyecto en un grafo semantico detallado que revela cada interconexion.

## La Solucion: Linter Avanzado y Extensible

PBIP Lens funciona como un linter de arquitectura y calidad de codigo. Al implementar una Arquitectura Hexagonal y patrones como Strategy y Pipeline, el motor de analisis realiza una evaluacion automatica y local de politicas predefinidas (como la deteccion de nodos huerfanos y la ausencia de descripciones de negocio). Su diseño extensible permite a los equipos incorporar reglas personalizadas de nomenclatura, seguridad o rendimiento adaptadas a sus estandares internos.

## Caracteristicas Principales

### 1. Explorador de Medidas
Identifica de forma inmediata que medidas estan siendo utilizadas activamente en los reportes y cuales son obsoletas.

* **Medidas Activas:** Medidas detectadas dentro de las estructuras JSON de los visuales del reporte, incluyendo cadenas de formato dinamico y titulos condicionales.
* **Medidas Huerfanas:** Medidas definidas en el modelo semantico que no tienen impacto estructural en los visuales del reporte y no son referenciadas por ninguna medida activa.
* **Grafo de Dependencias DAX:** Expande cualquier medida para ver su linaje completo (dependencias upstream y dependientes downstream). El arbol de dependencias advierte de forma proactiva si una medida no utilizada es fuente upstream de una medida activa critica.
* **Soporte de Carpetas de Presentacion:** Las medidas se agrupan automaticamente segun la estructura de carpetas logica definida en Power BI Desktop.

### 2. Auditoria de Tablas y Columnas
Organiza e inspecciona tus tablas y columnas con la misma granularidad que las medidas. Incluye agrupacion por carpetas, diferenciacion de tipos (fisica vs. calculada) y navegacion directa al codigo fuente TMDL.

### 3. Explorador de Consultas (Vista Previa)
Inspecciona scripts de Power Query (M) directamente desde VS Code. PBIP Lens extrae el codigo M desde las particiones y expresiones globales, permitiendo auditar la logica de transformacion sin necesidad de abrir el editor externo de Power Query.

### 4. Paneles Interactivos
* **Panel de Salud del Modelo:** Proporciona un resumen ejecutivo del estado del proyecto, incluyendo una puntuacion global de huerfanos, ratios de activos activos vs. huerfanos y conteo total de visuales.
* **Paneles de Medida y Columna:** Paneles interactivos dedicados a activos individuales. Incluyen definiciones DAX con resaltado de sintaxis, indicadores de dependencias e inspeccion de metadatos.

### 5. Integracion de IA Multi-Nivel (BYOK)
PBIP Lens incluye un motor de IA opcional de nivel profesional diseñado para analizar logica DAX compleja y proporcionar recomendaciones arquitectonicas directamente en los paneles de medidas.
* **Bring Your Own Key (BYOK):** La arquitectura garantiza la seguridad utilizando el almacen de secretos nativo de VS Code (SecretStorage). Las claves de API nunca se guardan en texto plano.
* **Soporte Multi-Proveedor:** Utiliza modelos locales a traves de la API nativa de VS Code LM (GitHub Copilot, Cursor) o configura proveedores externos como Groq, Google Gemini u OpenAI.
* **Respuestas en Streaming:** El analisis de IA se transmite directamente a la interfaz del panel para obtener retroalimentacion inmediata.

### 6. Navegacion Nativa al Codigo Fuente
Interactua con cualquier medida o columna en el explorador lateral y PBIP Lens abrira instantaneamente el archivo `.tmdl` correspondiente, posicionando el cursor exactamente en la definicion fuente para auditoria o edicion inmediata.

## Guia de Inicio Rapido

1. Abre la carpeta raiz de tu proyecto Power BI (.pbip) en VS Code.
2. Navega a la vista de PBIP Lens en la barra de actividad.
3. La extension escaneara automaticamente el espacio de trabajo para localizar las definiciones del Modelo Semantico (.SemanticModel) y el Reporte (.Report).
4. Utiliza los arboles del explorador para navegar por los linajes, o haz clic en activos especificos para abrir su codigo fuente o paneles de auditoria detallados.

## Arquitectura y Privacidad

PBIP Lens esta construido con un enfoque estricto en rendimiento y seguridad de datos empresariales:

* **Ejecucion 100% Local:** Ningun dato de esquema, metadato de reporte o codigo DAX es transmitido a servidores externos durante las operaciones de auditoria estandar. La transmision externa unicamente ocurre si se activa explicitamente la funcion de Explicador IA con el proveedor de API configurado.
* **Analisis Estructural Profundo:** A diferencia de las busquedas genericas de texto plano que generan falsos positivos, el motor principal analiza las estructuras profundamente anidadas de los formatos modernos `.pbir` y las definiciones JSON de los visuales.

## Motor Interno

PBIP Lens utiliza un motor de analisis estatico de multiples capas:

* **Analizador Estatico TMDL:** Un parser robusto que interpreta la jerarquia de objetos del Lenguaje de Definicion de Modelos Tabulares (TMDL), extrayendo definiciones DAX limpias mientras gestiona comentarios en linea y metatags de formato.
* **Motor de Grafo con Busqueda en Anchura (BFS):** Las dependencias se calculan mediante un algoritmo de recorrido BFS. Si la Columna A alimenta la Medida B, y la Medida B se utiliza en un visual, el motor identifica correctamente la Columna A como activa.
* **Mapeo de Estructura de Reportes:** El motor interpreta el esquema `visual.json` para identificar tanto las referencias directas de campos como las configuraciones ocultas dentro del layout del reporte.

## Limitaciones Conocidas

* El motor de analisis actual requiere que los proyectos esten guardados utilizando el formato de Lenguaje de Definicion de Modelos Tabulares (TMDL).
* La deteccion de uso en visuales de terceros altamente personalizados que utilicen estructuras JSON no estandar puede requerir validacion manual.

## Licencia

Este proyecto esta licenciado bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para mas detalles.
