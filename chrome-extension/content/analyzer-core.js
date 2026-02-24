/**
 * NoseyCoder Analyzer Core
 * Shared static analysis engine for JavaScript/TypeScript and Python.
 * Computes: Cyclomatic Complexity, Halstead Metrics, Maintainability Index
 * Provides: Linter suggestions, Refactoring recommendations
 */

const NoseyCoderAnalyzer = (() => {

  // ─── Language Detection ───
  function detectLanguage(filename) {
    if (!filename) return 'unknown';
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      mjs: 'javascript', cjs: 'javascript',
      py: 'python', pyw: 'python'
    };
    return map[ext] || 'unknown';
  }

  // ─── Tokenizer ───
  const JS_KEYWORDS = new Set([
    'break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete',
    'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof',
    'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var',
    'void', 'while', 'with', 'class', 'const', 'enum', 'export', 'extends',
    'import', 'super', 'implements', 'interface', 'let', 'package', 'private',
    'protected', 'public', 'static', 'yield', 'async', 'await', 'of'
  ]);

  const PY_KEYWORDS = new Set([
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
    'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
    'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
    'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
    'while', 'with', 'yield'
  ]);

  const JS_OPERATORS = new Set([
    '+', '-', '*', '/', '%', '**', '=', '+=', '-=', '*=', '/=', '%=',
    '**=', '==', '!=', '===', '!==', '<', '>', '<=', '>=', '&&', '||',
    '!', '&', '|', '^', '~', '<<', '>>', '>>>', '?', ':', '??', '?.',
    '++', '--', '=>', '...', '&&=', '||=', '??='
  ]);

  const PY_OPERATORS = new Set([
    '+', '-', '*', '/', '//', '%', '**', '=', '+=', '-=', '*=', '/=',
    '//=', '%=', '**=', '==', '!=', '<', '>', '<=', '>=', 'and', 'or',
    'not', 'in', 'is', '&', '|', '^', '~', '<<', '>>', ':=', '->', ':'
  ]);

  // ─── Function Extraction ───
  function extractFunctions(code, language) {
    const functions = [];
    const lines = code.split('\n');

    if (language === 'javascript' || language === 'typescript') {
      return extractJSFunctions(code, lines);
    } else if (language === 'python') {
      return extractPyFunctions(code, lines);
    }
    return functions;
  }

  function extractJSFunctions(code, lines) {
    const functions = [];
    const patterns = [
      /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function\s*)?\(([^)]*)\)\s*(?:=>)?/g,
      /(\w+)\s*\(([^)]*)\)\s*\{/g,
      /(?:async\s+)?(\w+)\s*=\s*\(([^)]*)\)\s*=>/g,
    ];

    const found = new Map();

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const name = match[1];
        const params = match[2] ? match[2].split(',').map(p => p.trim()).filter(Boolean) : [];
        const startIndex = match.index;
        const startLine = code.substring(0, startIndex).split('\n').length;

        if (found.has(name + ':' + startLine)) continue;
        found.set(name + ':' + startLine, true);

        const endLine = findJSFunctionEnd(lines, startLine - 1);
        const body = lines.slice(startLine - 1, endLine).join('\n');

        functions.push({
          name,
          params,
          startLine,
          endLine,
          body,
          loc: endLine - startLine + 1
        });
      }
    }

    return functions;
  }

  function findJSFunctionEnd(lines, startIdx) {
    let braceCount = 0;
    let started = false;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      for (const ch of line) {
        if (ch === '{') { braceCount++; started = true; }
        if (ch === '}') { braceCount--; }
        if (started && braceCount === 0) return i + 1;
      }
    }
    return Math.min(startIdx + 50, lines.length);
  }

  function extractPyFunctions(code, lines) {
    const functions = [];
    const pattern = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/gm;
    let match;

    while ((match = pattern.exec(code)) !== null) {
      const indent = match[1].length;
      const name = match[2];
      const params = match[3] ? match[3].split(',').map(p => p.trim().split(':')[0].split('=')[0].trim()).filter(Boolean) : [];
      const startLine = code.substring(0, match.index).split('\n').length;

      const endLine = findPyFunctionEnd(lines, startLine - 1, indent);
      const body = lines.slice(startLine - 1, endLine).join('\n');

      functions.push({
        name,
        params: params.filter(p => p !== 'self' && p !== 'cls'),
        startLine,
        endLine,
        body,
        loc: endLine - startLine + 1
      });
    }

    return functions;
  }

  function findPyFunctionEnd(lines, startIdx, baseIndent) {
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      const currentIndent = line.length - line.trimStart().length;
      if (currentIndent <= baseIndent && line.trim() !== '') {
        return i;
      }
    }
    return lines.length;
  }

  // ─── Cyclomatic Complexity ───
  function computeCyclomaticComplexity(code, language) {
    let complexity = 1;
    const cleanCode = removeCommentsAndStrings(code, language);

    if (language === 'javascript' || language === 'typescript') {
      const jsDecisions = [
        /\bif\b/g, /\belse\s+if\b/g, /\bfor\b/g, /\bwhile\b/g,
        /\bcase\b/g, /\bcatch\b/g, /\?\s*[^:]/g, /&&/g, /\|\|/g,
        /\?\?/g
      ];
      for (const pattern of jsDecisions) {
        const matches = cleanCode.match(pattern);
        if (matches) complexity += matches.length;
      }
    } else if (language === 'python') {
      const pyDecisions = [
        /\bif\b/g, /\belif\b/g, /\bfor\b/g, /\bwhile\b/g,
        /\bexcept\b/g, /\band\b/g, /\bor\b/g,
        /\bif\b.*\belse\b/g
      ];
      for (const pattern of pyDecisions) {
        const matches = cleanCode.match(pattern);
        if (matches) complexity += matches.length;
      }
    }

    return complexity;
  }

  // ─── Halstead Metrics ───
  function computeHalsteadMetrics(code, language) {
    const cleanCode = removeCommentsAndStrings(code, language);
    const operators = new Map();
    const operands = new Map();
    const keywords = language === 'python' ? PY_KEYWORDS : JS_KEYWORDS;
    const opSet = language === 'python' ? PY_OPERATORS : JS_OPERATORS;

    // Extract tokens
    const tokenPattern = /[a-zA-Z_$]\w*|[+\-*/%=!<>&|^~?:]+|\d+\.?\d*|"[^"]*"|'[^']*'|`[^`]*`/g;
    let match;

    while ((match = tokenPattern.exec(cleanCode)) !== null) {
      const token = match[0];
      if (opSet.has(token) || keywords.has(token)) {
        operators.set(token, (operators.get(token) || 0) + 1);
      } else if (/^[a-zA-Z_$]/.test(token) || /^\d/.test(token)) {
        operands.set(token, (operands.get(token) || 0) + 1);
      }
    }

    const n1 = operators.size;      // unique operators
    const n2 = operands.size;       // unique operands
    const N1 = [...operators.values()].reduce((a, b) => a + b, 0);  // total operators
    const N2 = [...operands.values()].reduce((a, b) => a + b, 0);  // total operands

    const vocabulary = n1 + n2;
    const length = N1 + N2;
    const volume = length > 0 && vocabulary > 0 ? length * Math.log2(vocabulary) : 0;
    const difficulty = n2 > 0 ? (n1 / 2) * (N2 / n2) : 0;
    const effort = volume * difficulty;
    const time = effort / 18;
    const bugs = volume / 3000;

    return {
      uniqueOperators: n1,
      uniqueOperands: n2,
      totalOperators: N1,
      totalOperands: N2,
      vocabulary,
      length,
      volume: Math.round(volume * 100) / 100,
      difficulty: Math.round(difficulty * 100) / 100,
      effort: Math.round(effort * 100) / 100,
      time: Math.round(time * 100) / 100,
      bugs: Math.round(bugs * 1000) / 1000
    };
  }

  // ─── Maintainability Index ───
  function computeMaintainabilityIndex(halsteadVolume, cyclomaticComplexity, loc) {
    if (loc <= 0 || halsteadVolume <= 0) return 100;

    let mi = 171
      - 5.2 * Math.log(halsteadVolume)
      - 0.23 * cyclomaticComplexity
      - 16.2 * Math.log(loc);

    // Normalize to 0-100
    mi = Math.max(0, Math.min(100, mi * 100 / 171));
    return Math.round(mi * 100) / 100;
  }

  // ─── Nesting Depth ───
  function computeMaxNestingDepth(code, language) {
    const lines = code.split('\n');
    let maxDepth = 0;

    if (language === 'javascript' || language === 'typescript') {
      let depth = 0;
      for (const line of lines) {
        for (const ch of line) {
          if (ch === '{') depth++;
          if (ch === '}') depth--;
          maxDepth = Math.max(maxDepth, depth);
        }
      }
    } else if (language === 'python') {
      let baseIndent = -1;
      for (const line of lines) {
        if (line.trim() === '') continue;
        const indent = line.length - line.trimStart().length;
        if (baseIndent === -1) baseIndent = indent;
        const relativeDepth = Math.floor((indent - baseIndent) / 4);
        maxDepth = Math.max(maxDepth, relativeDepth);
      }
    }

    return maxDepth;
  }

  // ─── Linter ───
  function runLinter(functions, code, language) {
    const issues = [];

    for (const fn of functions) {
      // Long function
      if (fn.loc > 50) {
        issues.push({
          type: 'warning',
          rule: 'max-function-length',
          message: `Function '${fn.name}' is ${fn.loc} lines long (max 50)`,
          line: fn.startLine,
          endLine: fn.endLine,
          severity: fn.loc > 100 ? 'critical' : 'warning'
        });
      }

      // Deep nesting
      const depth = computeMaxNestingDepth(fn.body, language);
      if (depth > 3) {
        issues.push({
          type: 'warning',
          rule: 'max-nesting-depth',
          message: `Function '${fn.name}' has nesting depth of ${depth} (max 3)`,
          line: fn.startLine,
          severity: depth > 5 ? 'critical' : 'warning'
        });
      }

      // Too many parameters
      if (fn.params.length > 5) {
        issues.push({
          type: 'warning',
          rule: 'max-params',
          message: `Function '${fn.name}' has ${fn.params.length} parameters (max 5)`,
          line: fn.startLine,
          severity: 'warning'
        });
      }

      // Multiple return statements
      const returnCount = (fn.body.match(/\breturn\b/g) || []).length;
      if (returnCount > 3) {
        issues.push({
          type: 'info',
          rule: 'multiple-returns',
          message: `Function '${fn.name}' has ${returnCount} return statements — consider simplifying`,
          line: fn.startLine,
          severity: 'info'
        });
      }

      // High complexity per function
      const cc = computeCyclomaticComplexity(fn.body, language);
      if (cc > 10) {
        issues.push({
          type: 'warning',
          rule: 'high-complexity',
          message: `Function '${fn.name}' has cyclomatic complexity of ${cc} (threshold: 10)`,
          line: fn.startLine,
          severity: cc > 20 ? 'critical' : 'warning'
        });
      }
    }

    // Large switch blocks
    const switchPattern = language === 'python'
      ? /match\s+\w+\s*:/g
      : /switch\s*\([^)]*\)\s*\{/g;
    const casePattern = language === 'python' ? /^\s*case\s+/gm : /\bcase\b/g;
    const switchMatches = code.match(switchPattern);
    if (switchMatches) {
      const caseCount = (code.match(casePattern) || []).length;
      if (caseCount > 10) {
        issues.push({
          type: 'warning',
          rule: 'large-switch',
          message: `Large switch/match block with ${caseCount} cases — consider using a lookup table or strategy pattern`,
          line: 1,
          severity: 'warning'
        });
      }
    }

    // Duplicate logic detection (simple: same-length functions with similar structure)
    for (let i = 0; i < functions.length; i++) {
      for (let j = i + 1; j < functions.length; j++) {
        const similarity = computeSimilarity(functions[i].body, functions[j].body);
        if (similarity > 0.8 && functions[i].loc > 5) {
          issues.push({
            type: 'info',
            rule: 'duplicate-logic',
            message: `Functions '${functions[i].name}' and '${functions[j].name}' share ${Math.round(similarity * 100)}% similar structure — consider extracting common logic`,
            line: functions[i].startLine,
            severity: 'info'
          });
        }
      }
    }

    return issues;
  }

  // ─── Refactoring Suggestions ───
  function generateRefactorSuggestions(functions, linterIssues, language) {
    const suggestions = [];

    for (const fn of functions) {
      const cc = computeCyclomaticComplexity(fn.body, language);

      if (cc > 15) {
        suggestions.push({
          function: fn.name,
          line: fn.startLine,
          type: 'decompose',
          priority: 'high',
          title: 'Decompose Complex Function',
          description: `Split '${fn.name}' into smaller sub-functions. CC=${cc} suggests multiple responsibilities.`,
          pattern: 'Extract Method'
        });
      }

      if (fn.params.length > 5) {
        suggestions.push({
          function: fn.name,
          line: fn.startLine,
          type: 'parameter-object',
          priority: 'medium',
          title: 'Use Parameter Object',
          description: `Replace ${fn.params.length} parameters with a configuration object/dataclass.`,
          pattern: language === 'python' ? 'Use @dataclass' : 'Use Options Object'
        });
      }

      if (fn.loc > 50) {
        suggestions.push({
          function: fn.name,
          line: fn.startLine,
          type: 'extract-method',
          priority: 'high',
          title: 'Extract Methods',
          description: `${fn.loc} LOC is too long. Identify logical blocks and extract them into named functions.`,
          pattern: 'Extract Method + Single Responsibility'
        });
      }

      const depth = computeMaxNestingDepth(fn.body, language);
      if (depth > 3) {
        suggestions.push({
          function: fn.name,
          line: fn.startLine,
          type: 'flatten',
          priority: 'medium',
          title: 'Reduce Nesting',
          description: `Nesting depth of ${depth}. Use early returns, guard clauses, or extract nested blocks.`,
          pattern: 'Guard Clause + Early Return'
        });
      }
    }

    // Dedupe based on function+type
    const seen = new Set();
    return suggestions.filter(s => {
      const key = s.function + ':' + s.type;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ─── Utility Functions ───
  function removeCommentsAndStrings(code, language) {
    if (language === 'python') {
      return code
        .replace(/'''[\s\S]*?'''/g, '')
        .replace(/"""[\s\S]*?"""/g, '')
        .replace(/#.*/g, '')
        .replace(/'[^']*'/g, '""')
        .replace(/"[^"]*"/g, '""');
    }
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
      .replace(/`[^`]*`/g, '""')
      .replace(/'[^']*'/g, '""')
      .replace(/"[^"]*"/g, '""');
  }

  function computeSimilarity(a, b) {
    const tokensA = a.replace(/\s+/g, ' ').trim().split(/\s+/);
    const tokensB = b.replace(/\s+/g, ' ').trim().split(/\s+/);
    if (tokensA.length === 0 || tokensB.length === 0) return 0;

    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    const intersection = [...setA].filter(t => setB.has(t)).length;
    const union = new Set([...setA, ...setB]).size;
    return union > 0 ? intersection / union : 0;
  }

  function getComplexityLevel(cc) {
    if (cc <= 5) return { label: 'Low', color: '#3fb950', level: 0 };
    if (cc <= 10) return { label: 'Moderate', color: '#d29922', level: 1 };
    if (cc <= 20) return { label: 'High', color: '#f85149', level: 2 };
    return { label: 'Critical', color: '#da3633', level: 3 };
  }

  function getMaintainabilityLevel(mi) {
    if (mi >= 80) return { label: 'Excellent', color: '#3fb950', level: 0 };
    if (mi >= 60) return { label: 'Good', color: '#58a6ff', level: 1 };
    if (mi >= 40) return { label: 'Moderate', color: '#d29922', level: 2 };
    if (mi >= 20) return { label: 'Poor', color: '#f85149', level: 3 };
    return { label: 'Critical', color: '#da3633', level: 4 };
  }

  // ─── Main Analysis Function ───
  function analyzeCode(code, filename) {
    const language = detectLanguage(filename);
    if (language === 'unknown') {
      return { error: 'Unsupported language', language: 'unknown' };
    }

    const lines = code.split('\n');
    const loc = lines.length;
    const sloc = lines.filter(l => l.trim() !== '' && !isComment(l, language)).length;
    const blankLines = lines.filter(l => l.trim() === '').length;
    const commentLines = lines.filter(l => isComment(l, language)).length;

    const functions = extractFunctions(code, language);
    const halstead = computeHalsteadMetrics(code, language);
    const fileCyclomaticComplexity = computeCyclomaticComplexity(code, language);
    const maintainabilityIndex = computeMaintainabilityIndex(halstead.volume, fileCyclomaticComplexity, loc);

    const functionMetrics = functions.map(fn => {
      const fnCC = computeCyclomaticComplexity(fn.body, language);
      const fnHalstead = computeHalsteadMetrics(fn.body, language);
      const fnMI = computeMaintainabilityIndex(fnHalstead.volume, fnCC, fn.loc);
      const fnNesting = computeMaxNestingDepth(fn.body, language);

      return {
        name: fn.name,
        startLine: fn.startLine,
        endLine: fn.endLine,
        loc: fn.loc,
        params: fn.params,
        paramCount: fn.params.length,
        cyclomaticComplexity: fnCC,
        complexityLevel: getComplexityLevel(fnCC),
        halstead: fnHalstead,
        maintainabilityIndex: fnMI,
        maintainabilityLevel: getMaintainabilityLevel(fnMI),
        maxNestingDepth: fnNesting,
        heatIntensity: 0
      };
    });

    // Compute heat intensity
    const maxCC = Math.max(1, ...functionMetrics.map(f => f.cyclomaticComplexity));
    functionMetrics.forEach(fn => {
      fn.heatIntensity = fn.cyclomaticComplexity / maxCC;
    });

    const linterIssues = runLinter(functions, code, language);
    const refactorSuggestions = generateRefactorSuggestions(functions, linterIssues, language);

    return {
      language,
      filename: filename || 'unknown',
      summary: {
        loc,
        sloc,
        blankLines,
        commentLines,
        functionCount: functions.length,
        cyclomaticComplexity: fileCyclomaticComplexity,
        complexityLevel: getComplexityLevel(fileCyclomaticComplexity),
        maintainabilityIndex,
        maintainabilityLevel: getMaintainabilityLevel(maintainabilityIndex),
        halstead
      },
      functions: functionMetrics,
      linterIssues,
      refactorSuggestions,
      heatmap: functionMetrics.map(fn => ({
        name: fn.name,
        startLine: fn.startLine,
        endLine: fn.endLine,
        intensity: fn.heatIntensity,
        complexity: fn.cyclomaticComplexity,
        color: fn.complexityLevel.color
      }))
    };
  }

  function isComment(line, language) {
    const trimmed = line.trim();
    if (language === 'python') return trimmed.startsWith('#');
    return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
  }

  // Public API
  return {
    analyzeCode,
    detectLanguage,
    computeCyclomaticComplexity,
    computeHalsteadMetrics,
    computeMaintainabilityIndex,
    extractFunctions,
    runLinter,
    generateRefactorSuggestions,
    getComplexityLevel,
    getMaintainabilityLevel
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NoseyCoderAnalyzer;
}
