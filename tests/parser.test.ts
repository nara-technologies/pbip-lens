import { DaxLexer } from '../src/core/analyzer/Lexer';
import { StructuralParser } from '../src/core/analyzer/StructuralParser';

describe('StructuralParser Golden Models', () => {
    let lexer: DaxLexer;
    let parser: StructuralParser;

    beforeEach(() => {
        lexer = new DaxLexer();
        parser = new StructuralParser();
    });

    test('Ignores references to local variables (Shadowing)', () => {
        const input = 'VAR Total = [MedidaReal] RETURN Total * 2';
        const tokens = lexer.tokenize(input);
        const references = parser.parse(tokens);

        // Should detect exactly 1 external reference ([MedidaReal])
        expect(references.length).toBe(1);
        expect(references[0].value).toBe('[MedidaReal]');

        // The identifier 'Total' should be discarded because it was declared locally by VAR
        const containsTotal = references.some((ref) => ref.value === 'Total');
        expect(containsTotal).toBe(false);
    });

    test('ScopeManager is case-insensitive and permits multiple declarations', () => {
        const input = `
            VAR BaseAmount = 100 
            VAR TAX_RATE = 0.15 
            RETURN baseAmount * tax_rate * [ExternalMeasure]
        `;
        const tokens = lexer.tokenize(input);
        const references = parser.parse(tokens);

        // Should detect exactly 1 external reference ([ExternalMeasure])
        expect(references.length).toBe(1);
        expect(references[0].value).toBe('[ExternalMeasure]');

        // Despite different casing ('baseAmount' vs 'BaseAmount'), it must not be extracted
        const containsBaseAmount = references.some(
            (ref) => ref.value.toLowerCase() === 'baseamount',
        );
        expect(containsBaseAmount).toBe(false);
    });

    test("Fuses qualified references via Look-Ahead ('Table'[Column])", () => {
        const input = `CALCULATE([Medida], 'Sales'[Region] = "NA")`;
        const tokens = lexer.tokenize(input);
        const references = parser.parse(tokens);

        // Should emit 2 solid references, fusing 'Sales' and [Region]
        const hasSalesRegion = references.some((ref) => ref.value === "'Sales'[Region]");
        const hasMedida = references.some((ref) => ref.value === '[Medida]');

        // Verify that no isolated parts exist due to lookup fusion
        const hasSalesIsolated = references.some((ref) => ref.value === "'Sales'");
        const hasRegionIsolated = references.some((ref) => ref.value === '[Region]');

        expect(hasSalesRegion).toBe(true);
        expect(hasMedida).toBe(true);
        expect(hasSalesIsolated).toBe(false);
        expect(hasRegionIsolated).toBe(false);
    });

    test('Silently filters out DAX functions (Function Look-Ahead)', () => {
        const input = `SUM('Ventas'[Monto]) + CALCULATE([Medida])`;
        const tokens = lexer.tokenize(input);
        const references = parser.parse(tokens);

        // Should emit exactly 'Ventas'[Monto] and [Medida]
        expect(references.length).toBe(2);

        const hasVentasMonto = references.some((ref) => ref.value === "'Ventas'[Monto]");
        const hasMedida = references.some((ref) => ref.value === '[Medida]');
        expect(hasVentasMonto).toBe(true);
        expect(hasMedida).toBe(true);

        // SUM (Identifier + '(') and CALCULATE (Keyword or Identifier + '(') must be ignored by lookup look-ahead
        const hasSum = references.some((ref) => ref.value === 'SUM');
        const hasCalculate = references.some((ref) => ref.value === 'CALCULATE');
        expect(hasSum).toBe(false);
        expect(hasCalculate).toBe(false);
    });
});
