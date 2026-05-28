# Guia de Contribucion

Esta guia esta dirigida a desarrolladores y colaboradores que deseen extender las capacidades de PBIP Lens. Explica la arquitectura interna del proyecto y proporciona un paso a paso detallado para añadir nuevas reglas de auditoria.

## Arquitectura de PBIP Lens

PBIP Lens se estructura bajo una arquitectura desacoplada basada en tres pilares fundamentales que garantizan mantenibilidad y extensibilidad:

1. **Puertos y Adaptadores (Arquitectura Hexagonal)**
   * **Puertos (src/core/ports/)**: Definen contratos abstractos puros (como `IFileSystem` e `ILogger`) que no tienen dependencias del entorno. Esto aisla el motor de analisis de cualquier dependencia del sistema de archivos nativo de Node.js o de la API de VS Code.
   * **Adaptadores (src/infrastructure/adapters/)**: Implementan los puertos para entornos especificos (por ejemplo, `NodeFileSystem` para ejecucion local o `VSCodeFileSystem` para la extension).

2. **Patron Pipeline**
   * El flujo de analisis estatico del motor semantico esta modularizado en fases secuenciales coordinadas a traves de un contexto compartido (`ProcessingContext`).
   * Las fases se ejecutan en orden:
     * `ExtractionPhase`: Ingiere archivos y crea los nodos en el grafo semantico.
     * `AnalysisPhase`: Analiza las expresiones DAX de TMDL, reportes y RLS.
     * `ResolutionPhase`: Conecta y consolida las aristas y dependencias en el grafo final.

3. **Patron Strategy**
   * El motor de auditoria (`AuditEngine`) delega la validacion de calidad del modelo a una coleccion de reglas independientes que implementan el contrato `IAuditRule`. Esto permite añadir o modificar reglas de auditoria sin alterar el flujo principal de analisis.

---

## Tutorial Estrella: Como añadir una nueva regla de auditoria

Siga este procedimiento paso a paso para añadir una nueva regla al linter de arquitectura.

### Paso 1: Crear la clase de la regla
Cree un nuevo archivo en el directorio `src/core/rules/`. Por ejemplo, para validar que las medidas no utilicen nombres reservados o cumplan un patron de nomenclatura, cree `src/core/rules/MeasureNamingRule.ts`.

### Paso 2: Implementar la interfaz `IAuditRule`
Escriba la clase implementando `IAuditRule`. Asegurese de definir la propiedad `id`, el `name`, la severidad por defecto y la logica de evaluacion en el metodo `evaluate`.

Ejemplo de codigo para `src/core/rules/MeasureNamingRule.ts`:

```typescript
import { CanonicalNode, NodeKinds } from '../models/CanonicalModel';
import { SemanticGraph } from '../graph/SemanticGraph';
import { IAuditRule, RuleViolation } from '../ports/IAuditRule';

export class MeasureNamingRule implements IAuditRule {
    public readonly id = 'measure-naming';
    public readonly name = 'Nomenclatura de Medidas';
    public readonly defaultSeverity = 'Medium';

    /**
     * Evalua si una medida cumple con las convenciones de nomenclatura especificadas.
     * @param node Nodo a evaluar.
     * @param graph Grafo semantico para consultas contextuales.
     * @returns RuleViolation si no cumple con la regla, o null si el nodo es valido.
     */
    public evaluate(node: CanonicalNode, graph: SemanticGraph): RuleViolation | null {
        // Solo evaluamos nodos de tipo Measure (Medida)
        if (node.kind !== NodeKinds.Measure) {
            return null;
        }

        // Ejemplo de validacion: el nombre no debe contener caracteres especiales como '%'
        if (node.name.includes('%')) {
            return {
                ruleId: this.id,
                message: `La medida "${node.name}" no debe incluir el caracter "%" en su nombre. Use terminos descriptivos en su lugar.`,
                severity: this.defaultSeverity,
            };
        }

        return null;
    }
}
```

### Paso 3: Registrar e Inyectar la regla en la Extension
Para que la regla sea ejecutada por el motor de auditoria, debe registrarse en la instanciacion del `AuditEngine` dentro del controlador principal de la extension:

Abra el archivo `src/extension/ExtensionController.ts` e inserte la nueva regla en la lista de reglas del constructor de `AuditEngine`:

```typescript
import { MeasureNamingRule } from '../core/rules/MeasureNamingRule';

// ...

export class ExtensionController {
    // ...
    private auditEngine = new AuditEngine(
        [
            new OrphanNodeRule(), 
            new MissingDescriptionRule(),
            new MeasureNamingRule() // Registro de la nueva regla
        ],
        this.loggerAdapter
    );
    // ...
}
```

### Paso 4: Validar en los Archivos de Pruebas
Agregue la regla en las pruebas de integracion correspondientes dentro de `tests/integration.test.ts` para validar que el comportamiento es correcto y consistente:

```typescript
const auditEngine = new AuditEngine(
    [
        new OrphanNodeRule(),
        new MissingDescriptionRule(),
        new MeasureNamingRule()
    ],
    logger
);
```

### Paso 5: Compilar y Ejecutar Pruebas
Ejecute la compilacion y las pruebas desde la terminal para confirmar que no haya errores de TypeScript ni fallos en las pruebas existentes:

```powershell
# Compilar TypeScript
npx tsc

# Ejecutar las pruebas unitarias e integradas
npx jest
```
