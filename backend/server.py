from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import math
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ─── Models ───
class AnalyzeRequest(BaseModel):
    code: str
    filename: str = "untitled.js"

class HalsteadResult(BaseModel):
    uniqueOperators: int = 0
    uniqueOperands: int = 0
    totalOperators: int = 0
    totalOperands: int = 0
    vocabulary: int = 0
    length: int = 0
    volume: float = 0
    difficulty: float = 0
    effort: float = 0
    time: float = 0
    bugs: float = 0

class ComplexityLevel(BaseModel):
    label: str
    color: str
    level: int

class FunctionMetric(BaseModel):
    name: str
    startLine: int
    endLine: int
    loc: int
    params: List[str]
    paramCount: int
    cyclomaticComplexity: int
    complexityLevel: ComplexityLevel
    halstead: HalsteadResult
    maintainabilityIndex: float
    maintainabilityLevel: ComplexityLevel
    maxNestingDepth: int
    heatIntensity: float

class LinterIssue(BaseModel):
    type: str
    rule: str
    message: str
    line: int
    severity: str
    endLine: Optional[int] = None

class RefactorSuggestion(BaseModel):
    function: str
    line: int
    type: str
    priority: str
    title: str
    description: str
    pattern: str

class HeatmapEntry(BaseModel):
    name: str
    startLine: int
    endLine: int
    intensity: float
    complexity: int
    color: str

class SummaryResult(BaseModel):
    loc: int
    sloc: int
    blankLines: int
    commentLines: int
    functionCount: int
    cyclomaticComplexity: int
    complexityLevel: ComplexityLevel
    maintainabilityIndex: float
    maintainabilityLevel: ComplexityLevel
    halstead: HalsteadResult

class AnalysisResult(BaseModel):
    language: str
    filename: str
    summary: SummaryResult
    functions: List[FunctionMetric]
    linterIssues: List[LinterIssue]
    refactorSuggestions: List[RefactorSuggestion]
    heatmap: List[HeatmapEntry]

class AnalysisRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    language: str
    loc: int
    complexity: int
    maintainability: float
    functionCount: int
    issueCount: int
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ─── Analysis Engine (Python port of analyzer-core.js) ───

JS_KEYWORDS = {
    'break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete',
    'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof',
    'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var',
    'void', 'while', 'with', 'class', 'const', 'enum', 'export', 'extends',
    'import', 'super', 'implements', 'interface', 'let', 'package', 'private',
    'protected', 'public', 'static', 'yield', 'async', 'await', 'of'
}

PY_KEYWORDS = {
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
    'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
    'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
    'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
    'while', 'with', 'yield'
}

JS_OPERATORS = {
    '+', '-', '*', '/', '%', '**', '=', '+=', '-=', '*=', '/=', '%=',
    '**=', '==', '!=', '===', '!==', '<', '>', '<=', '>=', '&&', '||',
    '!', '&', '|', '^', '~', '<<', '>>', '>>>', '?', ':', '??', '?.',
    '++', '--', '=>', '...', '&&=', '||=', '??='
}

PY_OPERATORS = {
    '+', '-', '*', '/', '//', '%', '**', '=', '+=', '-=', '*=', '/=',
    '//=', '%=', '**=', '==', '!=', '<', '>', '<=', '>=', 'and', 'or',
    'not', 'in', 'is', '&', '|', '^', '~', '<<', '>>', ':=', '->', ':'
}

def detect_language(filename: str) -> str:
    if not filename:
        return 'unknown'
    ext = filename.rsplit('.', 1)[-1].lower()
    lang_map = {
        'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
        'mjs': 'javascript', 'cjs': 'javascript', 'py': 'python', 'pyw': 'python'
    }
    return lang_map.get(ext, 'unknown')

def remove_comments_and_strings(code: str, language: str) -> str:
    if language == 'python':
        code = re.sub(r"'''[\s\S]*?'''", '', code)
        code = re.sub(r'"""[\s\S]*?"""', '', code)
        code = re.sub(r'#.*', '', code)
        code = re.sub(r"'[^']*'", '""', code)
        code = re.sub(r'"[^"]*"', '""', code)
        return code
    code = re.sub(r'/\*[\s\S]*?\*/', '', code)
    code = re.sub(r'//.*', '', code)
    code = re.sub(r'`[^`]*`', '""', code)
    code = re.sub(r"'[^']*'", '""', code)
    code = re.sub(r'"[^"]*"', '""', code)
    return code

def is_comment(line: str, language: str) -> bool:
    trimmed = line.strip()
    if language == 'python':
        return trimmed.startswith('#')
    return trimmed.startswith('//') or trimmed.startswith('/*') or trimmed.startswith('*')

def compute_cyclomatic_complexity(code: str, language: str) -> int:
    complexity = 1
    clean = remove_comments_and_strings(code, language)
    if language in ('javascript', 'typescript'):
        patterns = [
            r'\bif\b', r'\belse\s+if\b', r'\bfor\b', r'\bwhile\b',
            r'\bcase\b', r'\bcatch\b', r'\?\s*[^:]', r'&&', r'\|\|', r'\?\?'
        ]
    else:
        patterns = [
            r'\bif\b', r'\belif\b', r'\bfor\b', r'\bwhile\b',
            r'\bexcept\b', r'\band\b', r'\bor\b'
        ]
    for p in patterns:
        complexity += len(re.findall(p, clean))
    return complexity

def compute_halstead(code: str, language: str) -> dict:
    clean = remove_comments_and_strings(code, language)
    keywords = PY_KEYWORDS if language == 'python' else JS_KEYWORDS
    ops = PY_OPERATORS if language == 'python' else JS_OPERATORS
    operators = {}
    operands = {}
    for match in re.finditer(r'[a-zA-Z_$]\w*|[+\-*/%=!<>&|^~?:]+|\d+\.?\d*', clean):
        token = match.group()
        if token in ops or token in keywords:
            operators[token] = operators.get(token, 0) + 1
        elif re.match(r'^[a-zA-Z_$]', token) or re.match(r'^\d', token):
            operands[token] = operands.get(token, 0) + 1

    n1 = len(operators)
    n2 = len(operands)
    N1 = sum(operators.values())
    N2 = sum(operands.values())
    vocabulary = n1 + n2
    length = N1 + N2
    volume = length * math.log2(vocabulary) if length > 0 and vocabulary > 0 else 0
    difficulty = (n1 / 2) * (N2 / n2) if n2 > 0 else 0
    effort = volume * difficulty
    time_val = effort / 18
    bugs = volume / 3000

    return {
        'uniqueOperators': n1, 'uniqueOperands': n2,
        'totalOperators': N1, 'totalOperands': N2,
        'vocabulary': vocabulary, 'length': length,
        'volume': round(volume, 2), 'difficulty': round(difficulty, 2),
        'effort': round(effort, 2), 'time': round(time_val, 2),
        'bugs': round(bugs, 3)
    }

def compute_maintainability_index(halstead_volume: float, cc: int, loc: int) -> float:
    if loc <= 0 or halstead_volume <= 0:
        return 100
    mi = 171 - 5.2 * math.log(halstead_volume) - 0.23 * cc - 16.2 * math.log(loc)
    mi = max(0, min(100, mi * 100 / 171))
    return round(mi, 2)

def compute_max_nesting(code: str, language: str) -> int:
    lines = code.split('\n')
    max_depth = 0
    if language in ('javascript', 'typescript'):
        depth = 0
        for line in lines:
            for ch in line:
                if ch == '{': depth += 1
                if ch == '}': depth -= 1
                max_depth = max(max_depth, depth)
    else:
        base_indent = -1
        for line in lines:
            if not line.strip(): continue
            indent = len(line) - len(line.lstrip())
            if base_indent == -1: base_indent = indent
            rel = (indent - base_indent) // 4
            max_depth = max(max_depth, rel)
    return max_depth

def extract_js_functions(code: str, lines: list) -> list:
    functions = []
    found = set()
    patterns = [
        r'(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)',
        r'(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function\s*)?\(([^)]*)\)\s*(?:=>)?',
        r'(\w+)\s*\(([^)]*)\)\s*\{',
    ]
    for pat in patterns:
        for m in re.finditer(pat, code):
            name = m.group(1)
            params_str = m.group(2) if m.lastindex >= 2 else ''
            params = [p.strip() for p in params_str.split(',') if p.strip()] if params_str else []
            start_line = code[:m.start()].count('\n') + 1
            key = f"{name}:{start_line}"
            if key in found: continue
            found.add(key)
            end_line = find_js_function_end(lines, start_line - 1)
            body = '\n'.join(lines[start_line - 1:end_line])
            functions.append({
                'name': name, 'params': params,
                'startLine': start_line, 'endLine': end_line,
                'body': body, 'loc': end_line - start_line + 1
            })
    return functions

def find_js_function_end(lines: list, start_idx: int) -> int:
    brace_count = 0
    started = False
    for i in range(start_idx, len(lines)):
        for ch in lines[i]:
            if ch == '{': brace_count += 1; started = True
            if ch == '}': brace_count -= 1
            if started and brace_count == 0: return i + 1
    return min(start_idx + 50, len(lines))

def extract_py_functions(code: str, lines: list) -> list:
    functions = []
    for m in re.finditer(r'^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)', code, re.MULTILINE):
        indent = len(m.group(1))
        name = m.group(2)
        params_str = m.group(3)
        params = [p.strip().split(':')[0].split('=')[0].strip() for p in params_str.split(',') if p.strip()] if params_str else []
        params = [p for p in params if p not in ('self', 'cls')]
        start_line = code[:m.start()].count('\n') + 1
        end_line = find_py_function_end(lines, start_line - 1, indent)
        body = '\n'.join(lines[start_line - 1:end_line])
        functions.append({
            'name': name, 'params': params,
            'startLine': start_line, 'endLine': end_line,
            'body': body, 'loc': end_line - start_line + 1
        })
    return functions

def find_py_function_end(lines: list, start_idx: int, base_indent: int) -> int:
    for i in range(start_idx + 1, len(lines)):
        line = lines[i]
        if not line.strip(): continue
        current_indent = len(line) - len(line.lstrip())
        if current_indent <= base_indent and line.strip():
            return i
    return len(lines)

def get_complexity_level(cc: int) -> dict:
    if cc <= 5: return {'label': 'Low', 'color': '#3fb950', 'level': 0}
    if cc <= 10: return {'label': 'Moderate', 'color': '#d29922', 'level': 1}
    if cc <= 20: return {'label': 'High', 'color': '#f85149', 'level': 2}
    return {'label': 'Critical', 'color': '#da3633', 'level': 3}

def get_maintainability_level(mi: float) -> dict:
    if mi >= 80: return {'label': 'Excellent', 'color': '#3fb950', 'level': 0}
    if mi >= 60: return {'label': 'Good', 'color': '#58a6ff', 'level': 1}
    if mi >= 40: return {'label': 'Moderate', 'color': '#d29922', 'level': 2}
    if mi >= 20: return {'label': 'Poor', 'color': '#f85149', 'level': 3}
    return {'label': 'Critical', 'color': '#da3633', 'level': 4}

def analyze_code(code: str, filename: str) -> dict:
    language = detect_language(filename)
    if language == 'unknown':
        return {'error': 'Unsupported language', 'language': 'unknown'}

    lines = code.split('\n')
    loc = len(lines)
    sloc = len([l for l in lines if l.strip() and not is_comment(l, language)])
    blank_lines = len([l for l in lines if not l.strip()])
    comment_lines = len([l for l in lines if is_comment(l, language)])

    if language in ('javascript', 'typescript'):
        functions = extract_js_functions(code, lines)
    else:
        functions = extract_py_functions(code, lines)

    halstead = compute_halstead(code, language)
    file_cc = compute_cyclomatic_complexity(code, language)
    mi = compute_maintainability_index(halstead['volume'], file_cc, loc)

    function_metrics = []
    for fn in functions:
        fn_cc = compute_cyclomatic_complexity(fn['body'], language)
        fn_halstead = compute_halstead(fn['body'], language)
        fn_mi = compute_maintainability_index(fn_halstead['volume'], fn_cc, fn['loc'])
        fn_nesting = compute_max_nesting(fn['body'], language)
        function_metrics.append({
            'name': fn['name'], 'startLine': fn['startLine'], 'endLine': fn['endLine'],
            'loc': fn['loc'], 'params': fn['params'], 'paramCount': len(fn['params']),
            'cyclomaticComplexity': fn_cc, 'complexityLevel': get_complexity_level(fn_cc),
            'halstead': fn_halstead, 'maintainabilityIndex': fn_mi,
            'maintainabilityLevel': get_maintainability_level(fn_mi),
            'maxNestingDepth': fn_nesting, 'heatIntensity': 0
        })

    max_cc = max((f['cyclomaticComplexity'] for f in function_metrics), default=1)
    if max_cc == 0: max_cc = 1
    for fm in function_metrics:
        fm['heatIntensity'] = fm['cyclomaticComplexity'] / max_cc

    linter_issues = run_linter(functions, code, language)
    refactor_suggestions = generate_refactor_suggestions(functions, language)

    return {
        'language': language, 'filename': filename,
        'summary': {
            'loc': loc, 'sloc': sloc, 'blankLines': blank_lines,
            'commentLines': comment_lines, 'functionCount': len(functions),
            'cyclomaticComplexity': file_cc, 'complexityLevel': get_complexity_level(file_cc),
            'maintainabilityIndex': mi, 'maintainabilityLevel': get_maintainability_level(mi),
            'halstead': halstead
        },
        'functions': function_metrics,
        'linterIssues': linter_issues,
        'refactorSuggestions': refactor_suggestions,
        'heatmap': [{
            'name': fm['name'], 'startLine': fm['startLine'], 'endLine': fm['endLine'],
            'intensity': fm['heatIntensity'], 'complexity': fm['cyclomaticComplexity'],
            'color': fm['complexityLevel']['color']
        } for fm in function_metrics]
    }

def run_linter(functions: list, code: str, language: str) -> list:
    issues = []
    for fn in functions:
        if fn['loc'] > 50:
            issues.append({
                'type': 'warning', 'rule': 'max-function-length',
                'message': f"Function '{fn['name']}' is {fn['loc']} lines long (max 50)",
                'line': fn['startLine'], 'severity': 'critical' if fn['loc'] > 100 else 'warning'
            })
        depth = compute_max_nesting(fn['body'], language)
        if depth > 3:
            issues.append({
                'type': 'warning', 'rule': 'max-nesting-depth',
                'message': f"Function '{fn['name']}' has nesting depth of {depth} (max 3)",
                'line': fn['startLine'], 'severity': 'critical' if depth > 5 else 'warning'
            })
        params = [p for p in fn['params'] if p not in ('self', 'cls')]
        if len(params) > 5:
            issues.append({
                'type': 'warning', 'rule': 'max-params',
                'message': f"Function '{fn['name']}' has {len(params)} parameters (max 5)",
                'line': fn['startLine'], 'severity': 'warning'
            })
        return_count = len(re.findall(r'\breturn\b', fn['body']))
        if return_count > 3:
            issues.append({
                'type': 'info', 'rule': 'multiple-returns',
                'message': f"Function '{fn['name']}' has {return_count} return statements",
                'line': fn['startLine'], 'severity': 'info'
            })
        cc = compute_cyclomatic_complexity(fn['body'], language)
        if cc > 10:
            issues.append({
                'type': 'warning', 'rule': 'high-complexity',
                'message': f"Function '{fn['name']}' has cyclomatic complexity of {cc} (threshold: 10)",
                'line': fn['startLine'], 'severity': 'critical' if cc > 20 else 'warning'
            })
    return issues

def generate_refactor_suggestions(functions: list, language: str) -> list:
    suggestions = []
    for fn in functions:
        cc = compute_cyclomatic_complexity(fn['body'], language)
        if cc > 15:
            suggestions.append({
                'function': fn['name'], 'line': fn['startLine'], 'type': 'decompose',
                'priority': 'high', 'title': 'Decompose Complex Function',
                'description': f"Split '{fn['name']}' into smaller sub-functions. CC={cc}.",
                'pattern': 'Extract Method'
            })
        params = [p for p in fn['params'] if p not in ('self', 'cls')]
        if len(params) > 5:
            suggestions.append({
                'function': fn['name'], 'line': fn['startLine'], 'type': 'parameter-object',
                'priority': 'medium', 'title': 'Use Parameter Object',
                'description': f"Replace {len(params)} parameters with a config object.",
                'pattern': 'Use @dataclass' if language == 'python' else 'Use Options Object'
            })
        if fn['loc'] > 50:
            suggestions.append({
                'function': fn['name'], 'line': fn['startLine'], 'type': 'extract-method',
                'priority': 'high', 'title': 'Extract Methods',
                'description': f"{fn['loc']} LOC — extract logical blocks into named functions.",
                'pattern': 'Extract Method + Single Responsibility'
            })
    return suggestions

# ─── API Routes ───
@api_router.get("/")
async def root():
    return {"message": "CodeScope API"}

@api_router.post("/analyze")
async def analyze_endpoint(req: AnalyzeRequest):
    result = analyze_code(req.code, req.filename)

    # Store analysis record
    if 'error' not in result:
        record = {
            'id': str(uuid.uuid4()),
            'filename': result['filename'],
            'language': result['language'],
            'loc': result['summary']['loc'],
            'complexity': result['summary']['cyclomaticComplexity'],
            'maintainability': result['summary']['maintainabilityIndex'],
            'functionCount': result['summary']['functionCount'],
            'issueCount': len(result['linterIssues']),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        await db.analysis_history.insert_one(record)

    return result

@api_router.get("/history")
async def get_history():
    records = await db.analysis_history.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return records

@api_router.get("/health")
async def health():
    return {"status": "ok", "service": "CodeScope API"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
