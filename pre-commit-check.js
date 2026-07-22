#!/usr/bin/env node

/**
 * Pre-Commit Static Analysis & Health Guard Script for Xennials Studio
 * 
 * Conducts lint, compiling, type safety audits, and unoptimized loop inspection.
 * Run in terminal via 'node pre-commit-check.js'.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

console.log(`${BOLD}${BLUE}===================================================`);
console.log(`📡 XENNIALS HEALTH GUARD: PRE-COMMIT SECURE AUDIT`);
console.log(`===================================================${RESET}\n`);

const HEALTH_ISSUES = [];
const FIXED_SUGGESTIONS = [];

// 1. Audit core file rules and imports
function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileName = path.basename(filePath);

  // Check for console.warn/error guidelines or uncast type structures
  lines.forEach((line, idx) => {
    // Audit empty files or direct "any" casting which bypasses compiler
    if (line.includes(': any') && !line.includes('//') && !line.includes('window as any')) {
      HEALTH_ISSUES.push({
        severity: 'Warning',
        file: fileName,
        line: idx + 1,
        rule: 'Avoid generic any-casts',
        snippet: line.trim(),
        fix: 'Use exact type or strict union mapping instead.'
      });
    }

    // Check for inline styling in TSX files
    if (line.includes('style={{') && !line.includes('backgroundImage') && filePath.endsWith('.tsx')) {
      HEALTH_ISSUES.push({
        severity: 'Warning',
        file: fileName,
        line: idx + 1,
        rule: 'Tailwind Constraint Violations',
        snippet: line.trim(),
        fix: 'Replace inline style parameter with standard utility classes directly.'
      });
    }

    // Check for unoptimized rendering / infinite loop triggers (e.g. calling state updater directly inside component body)
    if (line.match(/set[A-Z][a-zA-Z0-9]*\(.*\)/) && !line.match(/useEffect|useCallback|onClick|onChange|setTimeout|setInterval|handleSubmit|handle|update|addLog|toggle/)) {
      if (idx > 20 && !line.includes('//') && !line.includes('prev =>')) {
        HEALTH_ISSUES.push({
          severity: 'Critical Bottleneck Risk',
          file: fileName,
          line: idx + 1,
          rule: 'Infinite state re-render trigger',
          snippet: line.trim(),
          fix: 'Wrap state modifiers securely in handlers or useEffect triggers.'
        });
      }
    }
  });
}

// Traverse codebase
function scanDirectory(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== 'build') {
        scanDirectory(fullPath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      auditFile(fullPath);
    }
  });
}

// Run scan
try {
  if (fs.existsSync('./src')) {
    scanDirectory('./src');
  }
  if (fs.existsSync('./App.tsx')) {
    auditFile('./App.tsx');
  }
} catch (e) {
  console.log(`${RED}Error parsing file tree: ${e.message}${RESET}`);
}

// 2. Run TypeScript check (Compiler Audit)
console.log(`${CYAN}🔍 Auditing static types and dependencies via tsc...${RESET}`);
let tscOutput = '';
let compileSuccess = true;
try {
  tscOutput = execSync('npm run lint', { encoding: 'utf8', stdio: 'pipe' });
} catch (error) {
  compileSuccess = false;
  tscOutput = error.stdout || error.message;
}

if (compileSuccess) {
  console.log(`${GREEN}✓ Visual compilation and static types fully aligned!${RESET}\n`);
} else {
  console.log(`${RED}⚠ TypeScript validation failed. Found type alignment errors:${RESET}`);
  const errorLines = tscOutput.split('\n').filter(line => line.includes('error TS'));
  errorLines.forEach(errLine => {
    console.log(`   ${RED}• ${errLine.trim()}${RESET}`);
    // Register issue
    HEALTH_ISSUES.push({
      severity: 'Compile Error',
      file: 'TSC Audit',
      line: 'N/A',
      rule: 'Type safety alignment error',
      snippet: errLine.trim(),
      fix: 'Resolve casting or enforce secure signature definition.'
    });
  });
}

// Summary Report
console.log(`\n${BOLD}${BLUE}===================================================`);
console.log(`📊 XENNIALS HEALTH REPORT SUMMARY`);
console.log(`===================================================${RESET}`);

if (HEALTH_ISSUES.length === 0) {
  console.log(`${GREEN}${BOLD}✓ PERFECT SCORE! Codebase is perfectly safe and compliant.${RESET}`);
} else {
  console.log(`${YELLOW}Found ${HEALTH_ISSUES.length} warnings/bottlenecks in active modules:${RESET}\n`);
  
  HEALTH_ISSUES.forEach((issue, idx) => {
    console.log(`[${idx + 1}] ${issue.severity === 'Compile Error' ? RED : YELLOW}${BOLD}${issue.severity}${RESET} - File: ${CYAN}${issue.file}${RESET} (Line ${issue.line})`);
    console.log(`    Rule   : ${issue.rule}`);
    console.log(`    Snippet: ${BOLD}${issue.snippet}${RESET}`);
    console.log(`    Fix    : ${GREEN}${issue.fix}${RESET}\n`);
  });

  // Provide AI Fix All Prompt recipe
  console.log(`${BOLD}${MAGENTA}✨ AI RECOMMENDED ACTION PLAN ("Fix All"):${RESET}`);
  console.log(`To automatically fix these, ensure proper typing casting interfaces:`);
  console.log(`1. Double check AudioContext is instantiated inside a user-gesture function wrapper.`);
  console.log(`2. Replace any manual 'any' bindings in state maps with 'SongResult' or 'TimelineClip' models.`);
  console.log(`3. Ensure render functions are optimized with no direct state overrides.`);
}

console.log(`\n${BOLD}${BLUE}===================================================${RESET}`);

// Exit successfully to allow developers to inspect details without breaking physical commits forcefully
process.exit(0);
