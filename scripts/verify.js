#!/usr/bin/env node
/**
 * Comprehensive Project Health & Code Integrity Check
 * 
 * Verifies:
 * 1. Undefined variables, broken references, and hook rules (oxlint with no-undef)
 * 2. Import & export resolution across all workspace files (no dead/broken imports)
 * 3. Named export validation (ensures every imported named symbol actually exists)
 * 4. Production bundle compilation (Vite build)
 * 
 * Usage:
 *   npm run check
 *   or: node scripts/verify.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.resolve(ROOT_DIR, 'src');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function logStep(stepNum, title) {
  console.log(`\n${COLORS.cyan}${COLORS.bold}[Step ${stepNum}] ${title}${COLORS.reset}`);
}

function logSuccess(msg) {
  console.log(`  ${COLORS.green}✔ ${msg}${COLORS.reset}`);
}

function logError(msg) {
  console.error(`  ${COLORS.red}✖ ${msg}${COLORS.reset}`);
}

function getAllFiles(dir, exts = ['.js', '.jsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else {
      const ext = path.extname(fullPath).toLowerCase();
      if (exts.includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// ============================================================================
// STEP 1: Strict Lint & Undefined Variable Audit (Catches ReferenceErrors)
// ============================================================================
function runLintAudit() {
  logStep(1, 'Auditing Undeclared Variables, Broken Refs & Hooks');
  try {
    const cmd = 'npx oxlint --deny no-undef --deny react/rules-of-hooks src';
    execSync(cmd, { cwd: ROOT_DIR, stdio: 'pipe' });
    logSuccess('Zero undeclared variables or broken hook references detected.');
    return true;
  } catch (err) {
    const output = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    logError('Undeclared variable or lint failure detected:');
    console.error(output);
    return false;
  }
}

// ============================================================================
// STEP 2: Import & Export Graph Integrity Check
// ============================================================================
function runImportExportAudit() {
  logStep(2, 'Validating Import & Export Graph Integrity');
  const files = getAllFiles(SRC_DIR);
  let hasErrors = false;
  let totalImports = 0;

  // Regex to match imports: import ... from '...'
  const importRegex = /(?:import|export)\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]/g;
  const namedImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;

  // Map of file paths to their exported symbols
  const fileExportsCache = new Map();

  function getExportsFromFile(filePath) {
    if (fileExportsCache.has(filePath)) return fileExportsCache.get(filePath);
    if (!fs.existsSync(filePath)) return new Set();

    const content = fs.readFileSync(filePath, 'utf8');
    const exports = new Set();

    // export function name, export const name, export class name
    const declMatch = content.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([a-zA-Z0-9_$]+)/g);
    for (const m of declMatch) exports.add(m[1]);

    // export { name, name as alias }
    const namedExportMatch = content.matchAll(/export\s*\{([^}]+)\}/g);
    for (const m of namedExportMatch) {
      const parts = m[1].split(',');
      for (const p of parts) {
        const clean = p.trim();
        if (!clean) continue;
        if (clean.includes(' as ')) {
          exports.add(clean.split(' as ')[1].trim());
        } else {
          exports.add(clean);
        }
      }
    }

    // export default
    if (/export\s+default\s+/.test(content)) {
      exports.add('default');
    }

    fileExportsCache.set(filePath, exports);
    return exports;
  }

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const relFile = path.relative(ROOT_DIR, file);

    // 1. Check relative import file existence
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('.')) {
        totalImports++;
        const dir = path.dirname(file);
        let resolvedPath = path.resolve(dir, importPath.split('?')[0]); // Strip query params like ?url

        // Try exact, .js, .jsx, /index.js, /index.jsx
        let targetExists = fs.existsSync(resolvedPath);
        if (!targetExists) {
          for (const ext of ['.js', '.jsx', '.json', '.svg', '.png', '.jpg']) {
            if (fs.existsSync(resolvedPath + ext)) {
              resolvedPath = resolvedPath + ext;
              targetExists = true;
              break;
            }
          }
        }

        if (!targetExists) {
          logError(`${relFile} -> Broken import target: "${importPath}"`);
          hasErrors = true;
        }
      }
    }

    // 2. Check named import symbol existence
    let namedMatch;
    while ((namedMatch = namedImportRegex.exec(content)) !== null) {
      const symbolsStr = namedMatch[1];
      const importPath = namedMatch[2];

      if (importPath.startsWith('.')) {
        const dir = path.dirname(file);
        let targetPath = path.resolve(dir, importPath.split('?')[0]);
        if (!fs.existsSync(targetPath)) {
          for (const ext of ['.js', '.jsx']) {
            if (fs.existsSync(targetPath + ext)) {
              targetPath = targetPath + ext;
              break;
            }
          }
        }

        if (fs.existsSync(targetPath)) {
          const targetExports = getExportsFromFile(targetPath);
          const importedSymbols = symbolsStr.split(',').map((s) => s.trim().split(' as ')[0].trim());

          for (const sym of importedSymbols) {
            if (sym && !targetExports.has(sym)) {
              logError(`${relFile} imports "${sym}" from "${importPath}", but "${sym}" is not exported!`);
              hasErrors = true;
            }
          }
        }
      }
    }
  }

  if (hasErrors) {
    return false;
  }

  logSuccess(`Validated ${files.length} source files and ${totalImports} imports with 100% resolution.`);
  return true;
}

// ============================================================================
// STEP 3: Production Build Verification
// ============================================================================
function runBuildAudit() {
  logStep(3, 'Compiling Production Distribution (Vite Build)');
  try {
    const output = execSync('npm run build', { cwd: ROOT_DIR, stdio: 'pipe' }).toString();
    const match = output.match(/built in ([0-9.]+s)/);
    const duration = match ? match[1] : 'OK';
    logSuccess(`Vite production bundle compiled successfully (${duration}).`);
    return true;
  } catch (err) {
    const output = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    logError('Production build failed:');
    console.error(output);
    return false;
  }
}

// ============================================================================
// MAIN RUNNER
// ============================================================================
function main() {
  console.log(`\n${COLORS.bold}===================================================${COLORS.reset}`);
  console.log(`${COLORS.bold}     AUTOMATED CODE HEALTH & INTEGRITY CHECK       ${COLORS.reset}`);
  console.log(`${COLORS.bold}===================================================${COLORS.reset}`);

  const step1 = runLintAudit();
  const step2 = runImportExportAudit();
  const step3 = runBuildAudit();

  console.log(`\n${COLORS.bold}===================================================${COLORS.reset}`);
  if (step1 && step2 && step3) {
    console.log(`${COLORS.green}${COLORS.bold}  ✔ ALL CHECKS PASSED — CODEBASE READY FOR RELEASE!${COLORS.reset}`);
    console.log(`${COLORS.bold}===================================================${COLORS.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${COLORS.red}${COLORS.bold}  ✖ INTEGRITY CHECK FAILED — SEE ERRORS ABOVE.${COLORS.reset}`);
    console.log(`${COLORS.bold}===================================================${COLORS.reset}\n`);
    process.exit(1);
  }
}

main();
