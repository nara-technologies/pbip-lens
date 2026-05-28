# Contribution Guide

[Leer en Español](CONTRIBUTING.es.md)

This guide is intended for developers and contributors who wish to extend the capabilities of PBIP Lens. It explains the project's internal architecture and provides a detailed step-by-step guide to adding new audit rules.

## PBIP Lens Architecture

PBIP Lens is structured under a decoupled architecture based on three fundamental pillars that guarantee maintainability and extensibility:

1. **Ports and Adapters (Hexagonal Architecture)**
   * **Ports (src/core/ports/)**: Define pure abstract contracts (such as `IFileSystem` and `ILogger`) that have no environment dependencies. This isolates the analysis engine from any dependency on the native Node.js file system or the VS Code API.
   * **Adapters (src/infrastructure/adapters/)**: Implement the ports for specific environments (for example, `NodeFileSystem` for local execution or `VSCodeFileSystem` for the extension).

2. **Pipeline Pattern**
   * The static analysis flow of the semantic engine is modularized into sequential phases coordinated through a shared context (`ProcessingContext`).
   * The phases execute in order:
     * `ExtractionPhase`: Ingests files and creates nodes in the semantic graph.
     * `AnalysisPhase`: Analyzes DAX expressions from TMDL, reports, and RLS.
     * `ResolutionPhase`: Connects and consolidates edges and dependencies in the final graph.

3. **Strategy Pattern**
   * The audit engine (`AuditEngine`) delegates model quality validation to a collection of independent rules that implement the `IAuditRule` contract. This allows audit rules to be added or modified without altering the main analysis flow.

---

## Step-by-Step Tutorial: How to Add a New Audit Rule

Follow this step-by-step procedure to add a new rule to the architecture linter.

### Step 1: Create the Rule Class
Create a new file in the `src/core/rules/` directory. For example, to validate that measures do not use reserved names or comply with a naming convention, create `src/core/rules/MeasureNamingRule.ts`.

### Step 2: Implement the `IAuditRule` Interface
Write the class implementing `IAuditRule`. Make sure to define the `id` property, `name`, default severity, and evaluation logic in the `evaluate` method.

Code example for `src/core/rules/MeasureNamingRule.ts`:

```typescript
import { CanonicalNode, NodeKinds } from '../models/CanonicalModel';
import { SemanticGraph } from '../graph/SemanticGraph';
import { IAuditRule, RuleViolation } from '../ports/IAuditRule';

export class MeasureNamingRule implements IAuditRule {
    public readonly id = 'measure-naming';
    public readonly name = 'Measure Naming';
    public readonly defaultSeverity = 'Medium';

    /**
     * Evaluates if a measure complies with the specified naming conventions.
     * @param node Node to evaluate.
     * @param graph Semantic graph for contextual queries.
     * @returns RuleViolation if it does not comply, or null if the node is valid.
     */
    public evaluate(node: CanonicalNode, graph: SemanticGraph): RuleViolation | null {
        // Only evaluate Measure nodes
        if (node.kind !== NodeKinds.Measure) {
            return null;
        }

        // Example validation: name should not contain special characters like '%'
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

### Step 3: Register and Inject the Rule into the Extension
For the rule to be executed by the audit engine, it must be registered when instantiating `AuditEngine` within the main extension controller:

Open the file `src/extension/ExtensionController.ts` and insert the new rule in the rules list of the `AuditEngine` constructor:

```typescript
import { MeasureNamingRule } from '../core/rules/MeasureNamingRule';

// ...

export class ExtensionController {
    // ...
    private auditEngine = new AuditEngine(
        [
            new OrphanNodeRule(), 
            new MissingDescriptionRule(),
            new MeasureNamingRule() // Registration of the new rule
        ],
        this.loggerAdapter
    );
    // ...
}
```

### Step 4: Validate in the Test Files
Add the rule in the corresponding integration tests within `tests/integration.test.ts` to validate that the behavior is correct and consistent:

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

### Step 5: Compile and Run Tests
Run the compilation and tests from the terminal to confirm there are no TypeScript errors or failures in existing tests:

```powershell
# Compile TypeScript
npx tsc

# Run unit and integration tests
npx jest
```
