#!/usr/bin/env node

/**
 * Script to run tests and display coverage summary with progress and failures
 * Usage: npm run test:coverage
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { setTimeout } from 'timers/promises';

const coverageDir = join(process.cwd(), 'coverage');

function getTotalLinesInFile(filePath) {
  try {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      return content.split('\n').length;
    }
  } catch (e) {
    // Ignore errors
  }
  return 0;
}

function calculateFileCoverage(fileData, fullPath = null) {
  // Handle both object and array formats for coverage data
  const getCoveredCount = (coverageData) => {
    if (!coverageData) return 0;
    if (Array.isArray(coverageData)) {
      return coverageData.filter(count => count > 0).length;
    }
    if (typeof coverageData === 'object') {
      return Object.values(coverageData).filter(count => count > 0).length;
    }
    return 0;
  };
  
  const getTotalCount = (mapData) => {
    if (!mapData) return 0;
    if (Array.isArray(mapData)) {
      return mapData.length;
    }
    if (typeof mapData === 'object') {
      return Object.keys(mapData).length;
    }
    return 0;
  };
  
  const statements = {
    covered: getCoveredCount(fileData.s),
    total: getTotalCount(fileData.statementMap)
  };
  
  const branches = {
    covered: getCoveredCount(fileData.b),
    total: getTotalCount(fileData.branchMap)
  };
  
  const functions = {
    covered: getCoveredCount(fileData.f),
    total: getTotalCount(fileData.fnMap)
  };
  
  // Calculate actual line coverage from statementMap
  // In v8 coverage format, there's no 'l' property - we need to calculate from statements
  // Each statement in statementMap has start/end line numbers
  const statementMap = fileData.statementMap || {};
  const statementCounts = fileData.s || {};
  
  // Handle both object and array formats
  const getStatementCount = (stmtId) => {
    if (Array.isArray(statementCounts)) {
      return statementCounts[parseInt(stmtId) - 1] || 0;
    }
    if (typeof statementCounts === 'object') {
      return statementCounts[stmtId] || 0;
    }
    return 0;
  };
  
  // Collect all unique line numbers that have executable statements
  const lineCoverage = new Map(); // line number -> has coverage
  
  const stmtMapKeys = Array.isArray(statementMap) 
    ? statementMap.map((_, i) => String(i + 1))
    : Object.keys(statementMap);
  
  stmtMapKeys.forEach(stmtId => {
    const stmt = Array.isArray(statementMap) 
      ? statementMap[parseInt(stmtId) - 1]
      : statementMap[stmtId];
    const count = getStatementCount(stmtId);
    const isCovered = count > 0;
    
    if (stmt && typeof stmt === 'object') {
      // Get all line numbers this statement spans
      const startLine = stmt.start?.line;
      const endLine = (stmt.end && stmt.end.line !== undefined) ? stmt.end.line : startLine;
      
      if (startLine !== undefined && startLine !== null) {
        const end = (endLine !== undefined && endLine !== null) ? endLine : startLine;
        // Mark all lines from start to end
        for (let line = startLine; line <= end; line++) {
          if (!lineCoverage.has(line)) {
            lineCoverage.set(line, false);
          }
          // If this statement is covered, mark the line as covered
          if (isCovered) {
            lineCoverage.set(line, true);
          }
        }
      }
    }
  });
  
  const totalExecutableLines = lineCoverage.size;
  const coveredExecutableLines = Array.from(lineCoverage.values()).filter(covered => covered).length;
  
  // Get total lines in the file (including blank lines, comments, etc.)
  const totalFileLines = fullPath ? getTotalLinesInFile(fullPath) : 0;
  
  const lines = {
    covered: coveredExecutableLines,
    total: totalExecutableLines,
    // Total file lines (including non-executable)
    totalFileLines: totalFileLines,
    // Percentage of total file lines that are covered (executable lines covered / total file lines)
    totalFileLinesPct: totalFileLines > 0 ? (coveredExecutableLines / totalFileLines) * 100 : 0
  };
  
  return {
    statements: {
      ...statements,
      pct: statements.total > 0 ? (statements.covered / statements.total) * 100 : 0
    },
    branches: {
      ...branches,
      pct: branches.total > 0 ? (branches.covered / branches.total) * 100 : 0
    },
    functions: {
      ...functions,
      pct: functions.total > 0 ? (functions.covered / functions.total) * 100 : 0
    },
    lines: {
      ...lines,
      pct: lines.total > 0 ? (lines.covered / lines.total) * 100 : 0
    }
  };
}

function getFileCoverageFromJSON() {
  const coveragePath = join(coverageDir, 'coverage-final.json');
  if (!existsSync(coveragePath)) {
    return null;
  }
  
  try {
    const data = JSON.parse(readFileSync(coveragePath, 'utf-8'));
    const projectRoot = process.cwd();
    const srcDir = join(projectRoot, 'src');
    
    const files = Object.keys(data)
      .filter(key => {
        // Only include files in src directory, not test files
        const isInSrc = key.includes(join(projectRoot, 'src')) || key.includes('/src/');
        const isTest = key.includes('/test/') || key.includes('.test.');
        const isSourceFile = key.endsWith('.ts') || key.endsWith('.tsx');
        return isInSrc && !isTest && isSourceFile;
      })
      .map(fullPath => {
        // Get relative path from src directory
        let relPath = fullPath;
        if (fullPath.includes(srcDir)) {
          relPath = relative(srcDir, fullPath);
        } else if (fullPath.includes('/src/')) {
          // Extract path after /src/
          const parts = fullPath.split('/src/');
          relPath = parts.length > 1 ? parts[1] : fullPath;
        }
        
        const coverage = calculateFileCoverage(data[fullPath], fullPath);
        return {
          file: relPath,
          fullPath: fullPath,
          ...coverage
        };
      })
      .filter(f => {
        // Only include files with meaningful code (exclude empty files and index.ts files that just re-export)
        return (f.statements.total > 0 || f.branches.total > 0 || f.functions.total > 0) &&
               !f.file.endsWith('index.ts'); // Skip barrel exports
      })
      .sort((a, b) => a.file.localeCompare(b.file)); // Sort alphabetically
    
    // Calculate totals
    const totals = files.reduce((acc, file) => {
      acc.statements.covered += file.statements.covered;
      acc.statements.total += file.statements.total;
      acc.branches.covered += file.branches.covered;
      acc.branches.total += file.branches.total;
      acc.functions.covered += file.functions.covered;
      acc.functions.total += file.functions.total;
      acc.lines.covered += file.lines.covered;
      acc.lines.total += file.lines.total;
      return acc;
    }, {
      statements: { covered: 0, total: 0 },
      branches: { covered: 0, total: 0 },
      functions: { covered: 0, total: 0 },
      lines: { covered: 0, total: 0 }
    });
    
    const totalCoverage = {
      statements: {
        ...totals.statements,
        pct: totals.statements.total > 0 ? (totals.statements.covered / totals.statements.total) * 100 : 0
      },
      branches: {
        ...totals.branches,
        pct: totals.branches.total > 0 ? (totals.branches.covered / totals.branches.total) * 100 : 0
      },
      functions: {
        ...totals.functions,
        pct: totals.functions.total > 0 ? (totals.functions.covered / totals.functions.total) * 100 : 0
      },
      lines: {
        ...totals.lines,
        pct: totals.lines.total > 0 ? (totals.lines.covered / totals.lines.total) * 100 : 0
      }
    };
    
    return { files, totalCoverage };
  } catch (e) {
    return null;
  }
}

function getCoverageFromJSONAndOutput(output) {
  // First, try to get full file list from JSON
  const coveragePath = join(coverageDir, 'coverage-final.json');
  let fileMap = new Map(); // Maps partial filename to full path
  
  if (existsSync(coveragePath)) {
    try {
      const data = JSON.parse(readFileSync(coveragePath, 'utf-8'));
      const projectRoot = process.cwd();
      
      Object.keys(data).forEach(fullPath => {
        if (fullPath.includes('/src/') && !fullPath.includes('/test/') && 
            (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
          const parts = fullPath.split('/');
          const filename = parts[parts.length - 1];
          // Store mapping from filename to full relative path
          const relPath = fullPath.includes(join(projectRoot, 'src')) 
            ? relative(join(projectRoot, 'src'), fullPath)
            : fullPath.split('/src/')[1] || filename;
          
          // Create truncated version mappings for various truncation lengths
          // vitest truncates long filenames like "...etailPage.tsx" 
          if (filename.length > 12) {
            // Try different truncation patterns
            const truncated1 = '...' + filename.slice(-12);
            const truncated2 = '...' + filename.slice(-13);
            const truncated3 = '...' + filename.slice(-14);
            fileMap.set(truncated1, relPath);
            fileMap.set(truncated2, relPath);
            fileMap.set(truncated3, relPath);
          }
          // Also store by just the filename
          fileMap.set(filename, relPath);
          
          // Store directory mappings too (for things like "...ponents/layout")
          const dirParts = relPath.split('/');
          if (dirParts.length > 1) {
            const dirName = dirParts.slice(0, -1).join('/');
            const truncatedDir = '...' + dirName.slice(-15);
            fileMap.set(truncatedDir, dirName);
          }
        }
      });
    } catch (e) {
      // Ignore JSON parsing errors
    }
  }
  
  // Now parse the coverage table from output
  const cleanOutput = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  const lines = cleanOutput.split('\n');
  
  const fileCoverage = [];
  let allFilesTotal = null;
  let inCoverageTable = false;
  let currentDir = '';
  
  // Find the coverage table (starts after "Coverage summary" section)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for the start of the coverage table
    if (line.includes('File') && line.includes('% Stmts') && line.includes('|')) {
      inCoverageTable = true;
      continue;
    }
    
    // Detect end of coverage table
    if (inCoverageTable && line.includes('-------------------') && line.match(/^-+\|/)) {
      // Check if this is the closing line (after table content)
      if (i > 0 && lines[i-1].includes('|') && lines[i-1].match(/[\d.]+\s+\|/)) {
        // This might be the end, but continue to see if there's more
      }
    }
    
    // Stop parsing after we've found the table and hit the end
    if (inCoverageTable && line.trim() === '') {
      // Empty line might signal end, but check a few more lines
      let hasMoreTable = false;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes('|') && lines[j].match(/[\d.]+\s+\|/)) {
          hasMoreTable = true;
          break;
        }
      }
      if (!hasMoreTable && fileCoverage.length > 0) {
        break; // We've parsed enough
      }
    }
    
    if (!inCoverageTable) continue;
    
    // Match "All files" total line
    const allFilesMatch = line.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
    if (allFilesMatch) {
      allFilesTotal = {
        statements: parseFloat(allFilesMatch[1]),
        branches: parseFloat(allFilesMatch[2]),
        functions: parseFloat(allFilesMatch[3]),
        lines: parseFloat(allFilesMatch[4])
      };
      continue;
    }
    
    // Match directory summary line
    const dirMatch = line.match(/^\s+(src\/[\w\/-]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
    if (dirMatch) {
      currentDir = dirMatch[1];
      continue;
    }
    
    // Match file coverage line - look for lines with pipes and numbers
    if (line.includes('|') && line.trim().length > 0) {
      const parts = line.split('|').map(p => p.trim());
      
      // Check if this looks like a coverage row (has at least 5 columns and 2nd column is a number)
      if (parts.length >= 5 && parts[1] && parts[1].match(/^\d+\.?\d*$/)) {
        let filename = parts[0].trim();
        
        // Skip directory summaries, totals, and header
        if (filename.startsWith('src/') || 
            filename === 'All files' || 
            filename === 'File' ||
            filename === '' ||
            // Skip directory summary lines (they don't have file extensions and aren't truncated)
            (filename.includes('/') && !filename.match(/\.(ts|tsx)$/) && !filename.startsWith('...'))) {
          continue;
        }
        
        // Only process if it looks like a filename (has extension or is truncated filename)
        if (!filename.match(/\.(ts|tsx)$/) && !filename.startsWith('...')) {
          continue;
        }
        
        // Resolve truncated filenames using fileMap
        if (filename.startsWith('...')) {
          const resolved = fileMap.get(filename);
          if (resolved) {
            filename = resolved.split('/').pop();
            currentDir = resolved.split('/').slice(0, -1).join('/');
          }
        }
        
        // Parse coverage percentages
        const statements = parseFloat(parts[1]) || 0;
        const branches = parseFloat(parts[2]) || 0;
        const functions = parseFloat(parts[3]) || 0;
        const lines = parseFloat(parts[4]) || 0;
        
        // Construct full relative path
        const fullPath = currentDir && currentDir !== '.' ? `${currentDir}/${filename}` : filename;
        
        fileCoverage.push({
          file: fullPath,
          filename: filename,
          directory: currentDir || '.',
          statements: statements,
          branches: branches,
          functions: functions,
          lines: lines
        });
      }
    }
  }
  
  return { fileCoverage, allFilesTotal };
}

function extractTestFailures(output) {
  const cleanOutput = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  const failures = [];
  
  // Match test file failures
  const testFilePattern = /❯\s+(src\/test\/[\w\/\.-]+\.test\.tsx)\s+\((\d+)\s+tests\s+\|\s+(\d+)\s+failed\)/g;
  let match;
  while ((match = testFilePattern.exec(cleanOutput)) !== null) {
    failures.push({
      file: match[1],
      total: parseInt(match[2]),
      failed: parseInt(match[3])
    });
  }
  
  // Extract individual test failures
  const individualFailures = [];
  const lines = cleanOutput.split('\n');
  let currentTestFile = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Track which test file we're in
    const testFileMatch = line.match(/❯\s+(src\/test\/[\w\/\.-]+\.test\.tsx)/);
    if (testFileMatch) {
      currentTestFile = testFileMatch[1];
    }
    
    // Extract failing test name
    if (line.includes('×') && line.match(/\s+×\s+/)) {
      const testName = line.replace(/.*×\s+/, '').replace(/\d+ms.*$/, '').trim();
      if (testName && 
          !testName.includes('Object.getElementError') && 
          !testName.includes('TestingLibrary') &&
          testName.length > 5) {
        individualFailures.push(`${currentTestFile} > ${testName}`);
      }
    }
  }
  
  return { fileFailures: failures, individualFailures: [...new Set(individualFailures)] };
}

async function runTestsAndCapture(filePath = null) {
  return new Promise((resolve) => {
    // Always run all tests to get accurate coverage
    // We'll filter the output later if a specific file is requested
    const child = spawn('npm', ['run', 'test:cov'], {
      cwd: process.cwd(),
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(text); // Show progress in real-time
      stdout += text;
    });
    
    child.stderr.on('data', (data) => {
      const text = data.toString();
      process.stderr.write(text); // Show progress in real-time
      stderr += text;
    });
    
    child.on('close', (code) => {
      resolve({ 
        exitCode: code || 0, 
        output: stdout + stderr 
      });
    });
    
    child.on('error', (error) => {
      resolve({ 
        exitCode: 1, 
        output: stdout + stderr,
        error: error.message 
      });
    });
  });
}

async function main() {
  // Get file path from command line arguments if provided
  const filePath = process.argv[2] || null;
  
  if (filePath) {
    console.log(`🧪 Running tests with coverage for: ${filePath}\n`);
  } else {
    console.log('🧪 Running tests with coverage...\n');
  }
  
  // Run tests with real-time progress display
  const { exitCode, output } = await runTestsAndCapture(filePath);
  
  // Wait for coverage files to be written
  await setTimeout(2000);
  
  // Extract test failures
  const failures = extractTestFailures(output);
  
  // Parse coverage from terminal output and JSON
  const coverageData = getCoverageFromJSONAndOutput(output);
  
  // Display results
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TEST RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Show test summary
  const testSummaryMatch = output.match(/Test Files\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed\s+\((\d+)\)/);
  const testCountMatch = output.match(/Tests\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed\s+\((\d+)\)/);
  
  if (testSummaryMatch) {
    const [, failed, passed, total] = testSummaryMatch;
    console.log(`Test Files: ${passed} passed, ${failed} failed (${total} total)`);
  }
  
  if (testCountMatch) {
    const [, failed, passed, total] = testCountMatch;
    console.log(`Tests:      ${passed} passed, ${failed} failed (${total} total)`);
  }
  
  // Show failures if any
  if (failures.fileFailures.length > 0) {
    console.log('\n❌ FAILING TEST FILES:\n');
    failures.fileFailures.forEach(f => {
      console.log(`  ${f.file}`);
      console.log(`    ${f.failed}/${f.total} tests failed`);
    });
    
    if (failures.individualFailures.length > 0) {
      console.log('\n❌ FAILING TESTS:\n');
      failures.individualFailures.slice(0, 15).forEach((test, idx) => {
        console.log(`  ${idx + 1}. ${test}`);
      });
      if (failures.individualFailures.length > 15) {
        console.log(`  ... and ${failures.individualFailures.length - 15} more`);
      }
    }
  }
  
  // Display files needing tests (0% coverage)
  if (coverageData && coverageData.fileCoverage.length > 0) {
    const filesNeedingTests = coverageData.fileCoverage.filter(f => 
      f.statements === 0 && f.branches === 0 && f.functions === 0 && f.lines === 0
    );
    
    if (filesNeedingTests.length > 0) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️  FILES NEEDING TESTS (0% Coverage)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      const grouped = {};
      filesNeedingTests.forEach(item => {
        const dir = item.directory || '.';
        if (!grouped[dir]) grouped[dir] = [];
        grouped[dir].push(item);
      });
      
      Object.keys(grouped).sort().forEach(dir => {
        if (dir !== '.') {
          console.log(`📁 ${dir}/`);
        }
        grouped[dir].forEach(item => {
          console.log(`  ${item.filename}`);
        });
      });
    }
  }
  
  // Get detailed file coverage from JSON for line counts
  const detailedCoverage = getFileCoverageFromJSON();
  
  // Normalize the requested file path for filtering
  let filterPath = null;
  if (filePath) {
    // Remove leading src/ if present, and normalize path separators
    filterPath = filePath.replace(/^src\//, '').replace(/\\/g, '/');
    // Remove leading ./ if present
    filterPath = filterPath.replace(/^\.\//, '');
    // Remove file extension for matching
    const filterPathNoExt = filterPath.replace(/\.(ts|tsx)$/, '');
    console.log(`\n📌 Filtering coverage for: ${filePath}\n`);
  }
  
  // If we have JSON data, use it as primary source (more accurate line counts)
  if (detailedCoverage && detailedCoverage.files && detailedCoverage.files.length > 0) {
    // Filter files if a specific file was requested
    let filesToShow = detailedCoverage.files;
    if (filterPath) {
      filesToShow = detailedCoverage.files.filter(file => {
        const filePathNormalized = file.file.replace(/\.(ts|tsx)$/, '');
        return file.file === filterPath || 
               file.file === `src/${filterPath}` ||
               filePathNormalized === filterPath ||
               filePathNormalized === filterPath.replace(/\.(ts|tsx)$/, '') ||
               file.file.endsWith(filterPath) ||
               file.file.includes(filterPath);
      });
      
      if (filesToShow.length === 0) {
        console.log(`\n⚠️  No coverage data found for: ${filePath}`);
        console.log(`   Available files (first 10):`);
        detailedCoverage.files.slice(0, 10).forEach(f => {
          console.log(`   - ${f.file}`);
        });
        process.exit(exitCode);
        return;
      }
    }
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 COVERAGE BY FILE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Calculate total lines in codebase (from all files, not just filtered)
    const totalCodebaseLines = detailedCoverage.files.reduce((sum, f) => sum + (f.lines.totalFileLines || 0), 0);
    
    // Group files by directory
    const grouped = {};
    filesToShow.forEach(file => {
      const parts = file.file.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      const filename = parts[parts.length - 1];
      
      if (!grouped[dir]) grouped[dir] = [];
      grouped[dir].push({ ...file, filename });
    });
    
    // Display files grouped by directory
    Object.keys(grouped).sort().forEach(dir => {
      if (dir !== '.') {
        console.log(`\n📁 ${dir}/`);
      }
      grouped[dir].forEach(file => {
        const stmts = file.statements.pct.toFixed(1);
        const branches = file.branches.pct.toFixed(1);
        const funcs = file.functions.pct.toFixed(1);
        const lines = file.lines.pct.toFixed(1);
        const lineInfo = ` (${file.lines.covered}/${file.lines.total} lines)`;
        
        // Add total file lines vs codebase total as percentage
        let totalFileInfo = '';
        if (file.lines.totalFileLines > 0 && totalCodebaseLines > 0) {
          const filePercentage = (file.lines.totalFileLines / totalCodebaseLines) * 100;
          totalFileInfo = ` (${filePercentage.toFixed(2)}% total)`;
        }
        
        console.log(`  ${file.filename.padEnd(40)} │ Stmts: ${stmts.padStart(6)}% │ Branches: ${branches.padStart(6)}% │ Funcs: ${funcs.padStart(6)}% │ Lines: ${lines.padStart(6)}%${lineInfo}${totalFileInfo}`);
      });
    });
    
    // Display summary - for single file, show just that file; otherwise show total
    if (filterPath && filesToShow.length === 1) {
      // Single file mode - show just this file's coverage
      const file = filesToShow[0];
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 COVERAGE SUMMARY: ${file.file}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`Statements : ${file.statements.pct.toFixed(2)}% (${file.statements.covered}/${file.statements.total})`);
      console.log(`Branches   : ${file.branches.pct.toFixed(2)}% (${file.branches.covered}/${file.branches.total})`);
      console.log(`Functions  : ${file.functions.pct.toFixed(2)}% (${file.functions.covered}/${file.functions.total})`);
      console.log(`Lines      : ${file.lines.pct.toFixed(2)}% (${file.lines.covered}/${file.lines.total} lines)`);
      if (file.lines.totalFileLines > 0 && totalCodebaseLines > 0) {
        const filePercentage = (file.lines.totalFileLines / totalCodebaseLines) * 100;
        console.log(`           : (${filePercentage.toFixed(2)}% total)`);
      }
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else if (detailedCoverage.totalCoverage) {
      // All files mode - show total
      const total = detailedCoverage.totalCoverage;
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 COVERAGE SUMMARY (TOTAL)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`Statements : ${total.statements.pct.toFixed(2)}% (${total.statements.covered}/${total.statements.total})`);
      console.log(`Branches   : ${total.branches.pct.toFixed(2)}% (${total.branches.covered}/${total.branches.total})`);
      console.log(`Functions  : ${total.functions.pct.toFixed(2)}% (${total.functions.covered}/${total.functions.total})`);
      console.log(`Lines      : ${total.lines.pct.toFixed(2)}% (${total.lines.covered}/${total.lines.total} lines)`);
      if (totalCodebaseLines > 0) {
        console.log(`           : (100.00% total)`);
      }
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  }
  // Fallback to terminal output if JSON not available
  else if (coverageData && coverageData.fileCoverage.length > 0) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 COVERAGE BY FILE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Create a map of file paths to detailed coverage data
    // Map by both full path and just filename for better matching
    const detailedMap = new Map();
    if (detailedCoverage && detailedCoverage.files) {
      detailedCoverage.files.forEach(file => {
        // Store by relative path
        detailedMap.set(file.file, file);
        // Also store by just filename for matching
        const filename = file.file.split('/').pop();
        if (filename && !detailedMap.has(filename)) {
          detailedMap.set(filename, file);
        }
        // Store by full path if available
        if (file.fullPath) {
          detailedMap.set(file.fullPath, file);
        }
      });
    }
    
    // Group by directory and remove duplicates
    const seen = new Set();
    const grouped = {};
    coverageData.fileCoverage.forEach(item => {
      // Remove duplicates based on file path
      const key = item.file;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      
      const dir = item.directory || '.';
      if (!grouped[dir]) grouped[dir] = [];
      grouped[dir].push(item);
    });
    
    // Display files grouped by directory
    Object.keys(grouped).sort().forEach(dir => {
      if (dir !== '.') {
        console.log(`\n📁 ${dir}/`);
      }
      grouped[dir].forEach(item => {
        const stmts = item.statements.toFixed(1);
        const branches = item.branches.toFixed(1);
        const funcs = item.functions.toFixed(1);
        const lines = item.lines.toFixed(1);
        
        // Get detailed line counts if available - try multiple matching strategies
        let detailed = detailedMap.get(item.file);
        if (!detailed) {
          // Try matching by full path
          detailed = detailedMap.get(item.file);
        }
        if (!detailed) {
          // Try matching by filename
          detailed = detailedMap.get(item.filename);
        }
        if (!detailed && item.file.includes('/')) {
          // Try matching by relative path from src
          const relPath = item.file.startsWith('src/') ? item.file : `src/${item.file}`;
          detailed = detailedMap.get(relPath);
        }
        
        let lineInfo = '';
        if (detailed && detailed.lines && detailed.lines.total > 0) {
          lineInfo = ` (${detailed.lines.covered}/${detailed.lines.total} lines)`;
        }
        
        console.log(`  ${item.filename.padEnd(40)} │ Stmts: ${stmts.padStart(6)}% │ Branches: ${branches.padStart(6)}% │ Funcs: ${funcs.padStart(6)}% │ Lines: ${lines.padStart(6)}%${lineInfo}`);
      });
    });
    
    // Display total
    if (coverageData.allFilesTotal) {
      const total = coverageData.allFilesTotal;
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 COVERAGE SUMMARY (TOTAL)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Get total line counts from detailed coverage if available
      let totalLinesInfo = '';
      if (detailedCoverage && detailedCoverage.totalCoverage && detailedCoverage.totalCoverage.lines) {
        const lines = detailedCoverage.totalCoverage.lines;
        totalLinesInfo = ` (${lines.covered}/${lines.total} lines)`;
      }
      
      console.log(`Statements : ${total.statements.toFixed(2)}%`);
      console.log(`Branches   : ${total.branches.toFixed(2)}%`);
      console.log(`Functions  : ${total.functions.toFixed(2)}%`);
      console.log(`Lines      : ${total.lines.toFixed(2)}%${totalLinesInfo}`);
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  } else {
    // Fallback: try to extract from terminal output
    const cleanOutput = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    const allFilesMatch = cleanOutput.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
    
    if (allFilesMatch) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 COVERAGE SUMMARY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`Statements : ${parseFloat(allFilesMatch[1]).toFixed(2)}%`);
      console.log(`Branches   : ${parseFloat(allFilesMatch[2]).toFixed(2)}%`);
      console.log(`Functions  : ${parseFloat(allFilesMatch[3]).toFixed(2)}%`);
      console.log(`Lines      : ${parseFloat(allFilesMatch[4]).toFixed(2)}%`);
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
      console.log('\n⚠️  Could not extract coverage data.\n');
    }
  }
  
  process.exit(exitCode);
}

main();
