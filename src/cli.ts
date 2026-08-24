#!/usr/bin/env node
import * as path from 'path';
import { NodeFileSystem } from './infrastructure/adapters/NodeFileSystem';
import { ConsoleLogger } from './infrastructure/adapters/ConsoleLogger';
import { ConfigManager } from './core/config/ConfigManager';
import { EngineFactory } from './core/factories/EngineFactory';
import { AuditEngine } from './core/engine/AuditEngine';
import { OrphanNodeRule } from './core/rules/OrphanNodeRule';
import { MissingDescriptionRule } from './core/rules/MissingDescriptionRule';

async function main() {
    const args = process.argv.slice(2);

    // Interceptor de banderas de ayuda y versión
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
PBIP Lens CLI - Advanced Semantic Model Governance

Usage:
  pbip-lens <path-to-project>

Options:
  -h, --help      Show this help message
  -v, --version   Show version number
  `);
        process.exit(0);
    }

    if (args.includes('--version') || args.includes('-v')) {
        const pkg = require('../package.json');
        console.log(`PBIP Lens v${pkg.version}`);
        process.exit(0);
    }

    const logger = new ConsoleLogger();
    const fs = new NodeFileSystem();

    try {
        const targetPath = path.resolve(
            args[0] && !args[0].startsWith('-') ? args[0] : process.cwd()
        );
        logger.info(`Resolving target project path: ${targetPath}`);

        const configManager = new ConfigManager(fs);
        const config = await configManager.loadConfig(targetPath);

        logger.info(`Loaded rules configuration: ${JSON.stringify(config.rules)}`);
        logger.info(`Loaded ignore patterns: ${JSON.stringify(config.ignore)}`);

        // Build semantic graph
        const semanticEngine = EngineFactory.createSemanticEngine(fs, logger);
        await semanticEngine.processProject(targetPath);

        // Run Audit engine
        const rules = [new OrphanNodeRule(), new MissingDescriptionRule()];
        const auditEngine = new AuditEngine(rules, logger, config);
        const report = auditEngine.analyze(semanticEngine.graph);

        let errorCount = 0;
        let warnCount = 0;
        const errorsList: string[] = [];
        const warnsList: string[] = [];

        for (const [nodeId, violations] of report.entries()) {
            const node = semanticEngine.graph.getNode(nodeId);
            const nodeName = node ? node.qualifiedName : nodeId;
            const location = node?.source ? ` (${fs.getBasename(node.source.filePath)}:${node.source.line})` : '';

            for (const violation of violations) {
                const logMsg = `  - \x1b[36m[${violation.ruleId}]\x1b[0m Node: ${nodeName}${location} | Message: ${violation.message}`;
                if (violation.level === 'error') {
                    errorCount++;
                    errorsList.push(logMsg);
                } else if (violation.level === 'warn') {
                    warnCount++;
                    warnsList.push(logMsg);
                }
            }
        }

        // Print Grouped Summary Report
        console.log('\n\x1b[1;4mPBIP LENS LINTER REPORT\x1b[0m\n');

        if (errorsList.length > 0) {
            console.log(`\x1b[31m\x1b[1mERRORS (${errorCount}):\x1b[0m`);
            errorsList.forEach((msg) => console.log(msg));
            console.log('');
        }

        if (warnsList.length > 0) {
            console.log(`\x1b[33m\x1b[1mWARNINGS (${warnCount}):\x1b[0m`);
            warnsList.forEach((msg) => console.log(msg));
            console.log('');
        }

        console.log('\x1b[1mSUMMARY:\x1b[0m');
        if (errorCount === 0 && warnCount === 0) {
            console.log('  \x1b[32m✔ No linter violations found. The model is clean!\x1b[0m');
        } else {
            console.log(`  - Errors: \x1b[31m${errorCount}\x1b[0m`);
            console.log(`  - Warnings: \x1b[33m${warnCount}\x1b[0m`);
        }
        console.log('');

        if (errorCount > 0) {
            console.error('\x1b[31m\x1b[1mResult: FAILED (Exit Code: 1 due to error-level violations)\x1b[0m\n');
            process.exit(1);
        } else {
            console.log('\x1b[32m\x1b[1mResult: PASSED (Exit Code: 0)\x1b[0m\n');
            process.exit(0);
        }
    } catch (err: any) {
        logger.error('Linter execution crashed', err);
        process.exit(1);
    }
}

main();
