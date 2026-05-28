/**
 * Scope Manager tracking local variable stacks in a DAX expression.
 * Operations are case-insensitive per DAX language specifications.
 */
export class ScopeManager {
    private stack: Set<string>[];

    constructor() {
        // Initialize with the global expression scope.
        this.stack = [new Set<string>()];
    }

    /**
     * Enters a new local scope (e.g. inner context from nested variables).
     */
    public enterScope(): void {
        this.stack.push(new Set<string>());
    }

    /**
     * Exits the current local scope, disposing of its isolated variables.
     */
    public exitScope(): void {
        if (this.stack.length > 1) {
            this.stack.pop();
        }
    }

     /**
      * Declares a new variable in the active scope.
      * @param name Variable identifier
      */
    public declareVariable(name: string): void {
        if (!name) return;
        const currentScope = this.stack[this.stack.length - 1];
        // DAX variables and function names are case-insensitive.
        currentScope.add(name.toLowerCase());
    }

     /**
      * Check if the identifier represents a previously declared local variable.
      * @param name Variable identifier
      * @returns True if resolved as a local variable, false if potential external reference.
      */
    public isLocalVariable(name: string): boolean {
        if (!name) return false;
        const lowerName = name.toLowerCase();

        // Perform local-to-global scope resolution to respect variable shadowing.
        for (let i = this.stack.length - 1; i >= 0; i--) {
            if (this.stack[i].has(lowerName)) {
                return true;
            }
        }
        return false;
    }
}
