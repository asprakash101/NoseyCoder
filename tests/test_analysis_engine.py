"""
Unit tests for the NoseyCoder analysis engine functions in server.py.
These tests are pure unit tests — no network or database needed.
"""
import sys
import os
import math

import pytest

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from server import (
    detect_language,
    compute_cyclomatic_complexity,
    compute_halstead,
    compute_maintainability_index,
    extract_js_functions,
    extract_py_functions,
    run_linter,
    generate_refactor_suggestions,
    get_complexity_level,
    get_maintainability_level,
    compute_max_nesting,
    analyze_code,
)

# Import sample code constants from conftest (pytest adds tests/ to sys.path)
from tests.conftest import (
    SAMPLE_JS_SIMPLE,
    SAMPLE_JS_COMPLEX,
    SAMPLE_PY_SIMPLE,
    SAMPLE_PY_COMPLEX,
    SAMPLE_JS_LONG_FUNCTION,
    SAMPLE_JS_DEEP_NESTING,
    SAMPLE_JS_HIGH_COMPLEXITY,
)


# ════════════════════════════════════════════════════
# detect_language()
# ════════════════════════════════════════════════════

class TestDetectLanguage:
    def test_js_extension(self):
        assert detect_language("app.js") == "javascript"

    def test_jsx_extension(self):
        assert detect_language("Component.jsx") == "javascript"

    def test_mjs_extension(self):
        assert detect_language("module.mjs") == "javascript"

    def test_cjs_extension(self):
        assert detect_language("config.cjs") == "javascript"

    def test_ts_extension(self):
        assert detect_language("app.ts") == "typescript"

    def test_tsx_extension(self):
        assert detect_language("Component.tsx") == "typescript"

    def test_py_extension(self):
        assert detect_language("script.py") == "python"

    def test_pyw_extension(self):
        assert detect_language("gui.pyw") == "python"

    def test_unknown_extension(self):
        assert detect_language("query.sql") == "unknown"

    def test_no_extension(self):
        assert detect_language("Makefile") == "unknown"

    def test_empty_string(self):
        assert detect_language("") == "unknown"

    def test_none_returns_unknown(self):
        # filename=None edge case
        assert detect_language(None) == "unknown"

    def test_case_insensitive(self):
        assert detect_language("App.JS") == "javascript"
        assert detect_language("script.PY") == "python"

    def test_dotfile(self):
        assert detect_language(".env") == "unknown"


# ════════════════════════════════════════════════════
# compute_cyclomatic_complexity()
# ════════════════════════════════════════════════════

class TestCyclomaticComplexity:
    def test_simple_function_js(self):
        code = "function hello() { return 1; }"
        cc = compute_cyclomatic_complexity(code, "javascript")
        assert cc == 1  # Base complexity, no branches

    def test_single_if_js(self):
        code = "function f(x) { if (x > 0) { return x; } return 0; }"
        cc = compute_cyclomatic_complexity(code, "javascript")
        assert cc == 2  # 1 base + 1 if

    def test_if_else_if_js(self):
        code = """
        function f(x) {
            if (x > 0) { return 1; }
            else if (x < 0) { return -1; }
            else { return 0; }
        }
        """
        cc = compute_cyclomatic_complexity(code, "javascript")
        assert cc >= 3  # 1 base + if + else if

    def test_for_loop_js(self):
        code = "function f(arr) { for (let i = 0; i < arr.length; i++) {} }"
        cc = compute_cyclomatic_complexity(code, "javascript")
        assert cc == 2  # 1 base + 1 for

    def test_logical_operators_js(self):
        code = "function f(a, b, c) { if (a && b || c) { return 1; } }"
        cc = compute_cyclomatic_complexity(code, "javascript")
        assert cc >= 4  # 1 base + if + && + ||

    def test_switch_cases_js(self):
        code = """
        function f(x) {
            switch(x) {
                case 1: return 'a';
                case 2: return 'b';
                case 3: return 'c';
            }
        }
        """
        cc = compute_cyclomatic_complexity(code, "javascript")
        assert cc >= 4  # 1 base + 3 cases

    def test_simple_function_py(self):
        code = "def hello():\n    return 1"
        cc = compute_cyclomatic_complexity(code, "python")
        assert cc == 1

    def test_if_elif_py(self):
        code = "def f(x):\n    if x > 0:\n        return 1\n    elif x < 0:\n        return -1"
        cc = compute_cyclomatic_complexity(code, "python")
        assert cc == 3  # 1 base + if + elif

    def test_for_loop_py(self):
        code = "def f(items):\n    for item in items:\n        pass"
        cc = compute_cyclomatic_complexity(code, "python")
        assert cc == 2  # 1 base + for

    def test_and_or_py(self):
        code = "def f(a, b, c):\n    if a and b or c:\n        return True"
        cc = compute_cyclomatic_complexity(code, "python")
        assert cc >= 4  # 1 base + if + and + or

    def test_except_py(self):
        code = "def f():\n    try:\n        pass\n    except ValueError:\n        pass"
        cc = compute_cyclomatic_complexity(code, "python")
        assert cc >= 2  # 1 base + except

    def test_complex_code_higher_cc(self):
        cc = compute_cyclomatic_complexity(SAMPLE_JS_COMPLEX, "javascript")
        assert cc > 5  # Complex code should have high CC


# ════════════════════════════════════════════════════
# compute_halstead()
# ════════════════════════════════════════════════════

class TestHalstead:
    def test_returns_all_keys(self):
        result = compute_halstead(SAMPLE_JS_SIMPLE, "javascript")
        expected_keys = {
            'uniqueOperators', 'uniqueOperands', 'totalOperators',
            'totalOperands', 'vocabulary', 'length', 'volume',
            'difficulty', 'effort', 'time', 'bugs'
        }
        assert set(result.keys()) == expected_keys

    def test_simple_code_positive_metrics(self):
        result = compute_halstead(SAMPLE_JS_SIMPLE, "javascript")
        assert result['uniqueOperators'] > 0
        assert result['uniqueOperands'] > 0
        assert result['volume'] > 0

    def test_complex_code_higher_metrics(self):
        simple = compute_halstead(SAMPLE_JS_SIMPLE, "javascript")
        complex_ = compute_halstead(SAMPLE_JS_COMPLEX, "javascript")
        assert complex_['volume'] > simple['volume']
        assert complex_['effort'] > simple['effort']

    def test_python_code(self):
        result = compute_halstead(SAMPLE_PY_SIMPLE, "python")
        assert result['volume'] > 0
        assert result['length'] > 0

    def test_empty_code(self):
        result = compute_halstead("", "javascript")
        assert result['volume'] == 0
        assert result['length'] == 0

    def test_vocabulary_equals_sum_unique(self):
        result = compute_halstead(SAMPLE_JS_SIMPLE, "javascript")
        assert result['vocabulary'] == result['uniqueOperators'] + result['uniqueOperands']

    def test_length_equals_sum_total(self):
        result = compute_halstead(SAMPLE_JS_SIMPLE, "javascript")
        assert result['length'] == result['totalOperators'] + result['totalOperands']


# ════════════════════════════════════════════════════
# compute_maintainability_index()
# ════════════════════════════════════════════════════

class TestMaintainabilityIndex:
    def test_zero_loc_returns_100(self):
        assert compute_maintainability_index(100.0, 5, 0) == 100

    def test_zero_volume_returns_100(self):
        assert compute_maintainability_index(0.0, 5, 10) == 100

    def test_result_bounded_0_to_100(self):
        mi = compute_maintainability_index(10000.0, 50, 500)
        assert 0 <= mi <= 100

    def test_simple_code_high_mi(self):
        # Small volume, low CC, few lines → high MI
        mi = compute_maintainability_index(50.0, 1, 5)
        assert mi > 60

    def test_complex_code_lower_mi(self):
        # Large volume, high CC, many lines → lower MI
        mi = compute_maintainability_index(5000.0, 25, 200)
        assert mi < 50

    def test_returns_float(self):
        mi = compute_maintainability_index(100.0, 5, 20)
        assert isinstance(mi, float)


# ════════════════════════════════════════════════════
# extract_js_functions()
# ════════════════════════════════════════════════════

class TestExtractJsFunctions:
    def test_simple_function_declaration(self):
        code = "function greet(name) {\n    return name;\n}"
        lines = code.split('\n')
        funcs = extract_js_functions(code, lines)
        assert len(funcs) >= 1
        assert funcs[0]['name'] == 'greet'
        assert funcs[0]['params'] == ['name']

    def test_multiple_functions(self):
        lines = SAMPLE_JS_COMPLEX.split('\n')
        funcs = extract_js_functions(SAMPLE_JS_COMPLEX, lines)
        names = [f['name'] for f in funcs]
        assert 'processOrder' in names
        assert 'validateItem' in names

    def test_function_line_numbers(self):
        code = "function a() {\n    return 1;\n}\nfunction b() {\n    return 2;\n}"
        lines = code.split('\n')
        funcs = extract_js_functions(code, lines)
        assert len(funcs) >= 2
        for fn in funcs:
            assert fn['startLine'] >= 1
            assert fn['endLine'] >= fn['startLine']

    def test_function_loc(self):
        lines = SAMPLE_JS_SIMPLE.split('\n')
        funcs = extract_js_functions(SAMPLE_JS_SIMPLE, lines)
        assert len(funcs) >= 1
        assert funcs[0]['loc'] > 0

    def test_no_params(self):
        code = "function noParams() {\n    return 42;\n}"
        lines = code.split('\n')
        funcs = extract_js_functions(code, lines)
        assert len(funcs) >= 1
        assert funcs[0]['params'] == []

    def test_control_flow_statements_not_matched_as_functions(self):
        code = """
        function calculate(x) {
            if (x > 0) {
                while (x < 10) {
                    for (let i = 0; i < 5; i++) {
                        switch (i) {
                            case 1: break;
                        }
                    }
                }
            }
            try {
                return x;
            } catch (err) {
                return 0;
            }
        }
        """
        lines = code.split('\n')
        funcs = extract_js_functions(code, lines)
        names = [f['name'] for f in funcs]
        assert 'calculate' in names
        for keyword in ['if', 'while', 'for', 'switch', 'catch', 'try']:
            assert keyword not in names


# ════════════════════════════════════════════════════
# extract_py_functions()
# ════════════════════════════════════════════════════

class TestExtractPyFunctions:
    def test_simple_def(self):
        code = "def greet(name):\n    return name"
        lines = code.split('\n')
        funcs = extract_py_functions(code, lines)
        assert len(funcs) == 1
        assert funcs[0]['name'] == 'greet'
        assert funcs[0]['params'] == ['name']

    def test_multiple_functions(self):
        lines = SAMPLE_PY_COMPLEX.split('\n')
        funcs = extract_py_functions(SAMPLE_PY_COMPLEX, lines)
        names = [f['name'] for f in funcs]
        assert 'process_pipeline' in names
        assert 'validate_config' in names

    def test_self_excluded_from_params(self):
        code = "class Foo:\n    def method(self, x, y):\n        return x + y"
        lines = code.split('\n')
        funcs = extract_py_functions(code, lines)
        assert len(funcs) >= 1
        assert 'self' not in funcs[0]['params']

    def test_async_def(self):
        code = "async def fetch(url):\n    return await get(url)"
        lines = code.split('\n')
        funcs = extract_py_functions(code, lines)
        assert len(funcs) == 1
        assert funcs[0]['name'] == 'fetch'

    def test_type_annotations_stripped(self):
        code = "def add(a: int, b: int) -> int:\n    return a + b"
        lines = code.split('\n')
        funcs = extract_py_functions(code, lines)
        assert funcs[0]['params'] == ['a', 'b']

    def test_default_values_stripped(self):
        code = "def f(x=10, y='hello'):\n    pass"
        lines = code.split('\n')
        funcs = extract_py_functions(code, lines)
        assert funcs[0]['params'] == ['x', 'y']

    def test_functions_separated_by_multiple_blank_lines(self):
        code = (
            "# Header\n"
            "CONSTANT = 42\n"
            "\n"
            "\n"
            "def foo():\n"
            "    global CONSTANT\n"
            "    return CONSTANT\n"
            "\n"
            "\n"
            "def bar(x, y):\n"
            "    return x + y\n"
        )
        lines = code.split('\n')
        funcs = extract_py_functions(code, lines)
        assert len(funcs) == 2
        assert funcs[0]['name'] == 'foo'
        assert funcs[0]['startLine'] == 5
        assert funcs[0]['endLine'] == 7
        assert funcs[0]['loc'] == 3
        assert funcs[1]['name'] == 'bar'
        assert funcs[1]['startLine'] == 10
        assert funcs[1]['endLine'] == 11
        assert funcs[1]['loc'] == 2


# ════════════════════════════════════════════════════
# get_complexity_level() & get_maintainability_level()
# ════════════════════════════════════════════════════

class TestComplexityLevel:
    def test_low(self):
        result = get_complexity_level(1)
        assert result['label'] == 'Low'
        assert result['level'] == 0

    def test_low_boundary(self):
        assert get_complexity_level(5)['label'] == 'Low'

    def test_moderate(self):
        assert get_complexity_level(6)['label'] == 'Moderate'
        assert get_complexity_level(10)['label'] == 'Moderate'

    def test_high(self):
        assert get_complexity_level(11)['label'] == 'High'
        assert get_complexity_level(20)['label'] == 'High'

    def test_critical(self):
        assert get_complexity_level(21)['label'] == 'Critical'
        assert get_complexity_level(100)['label'] == 'Critical'


class TestMaintainabilityLevel:
    def test_excellent(self):
        assert get_maintainability_level(80)['label'] == 'Excellent'
        assert get_maintainability_level(100)['label'] == 'Excellent'

    def test_good(self):
        assert get_maintainability_level(60)['label'] == 'Good'
        assert get_maintainability_level(79)['label'] == 'Good'

    def test_moderate(self):
        assert get_maintainability_level(40)['label'] == 'Moderate'
        assert get_maintainability_level(59)['label'] == 'Moderate'

    def test_poor(self):
        assert get_maintainability_level(20)['label'] == 'Poor'
        assert get_maintainability_level(39)['label'] == 'Poor'

    def test_critical(self):
        assert get_maintainability_level(19)['label'] == 'Critical'
        assert get_maintainability_level(0)['label'] == 'Critical'


# ════════════════════════════════════════════════════
# compute_max_nesting()
# ════════════════════════════════════════════════════

class TestMaxNesting:
    def test_no_nesting_js(self):
        code = "function f() { return 1; }"
        assert compute_max_nesting(code, "javascript") == 1

    def test_deep_nesting_js(self):
        depth = compute_max_nesting(SAMPLE_JS_DEEP_NESTING, "javascript")
        assert depth >= 4

    def test_python_nesting(self):
        code = "def f():\n    if True:\n        for x in y:\n            pass"
        depth = compute_max_nesting(code, "python")
        assert depth >= 2


# ════════════════════════════════════════════════════
# run_linter()
# ════════════════════════════════════════════════════

class TestRunLinter:
    def _make_fn(self, name, body, language):
        """Helper to build a function dict like extract_*_functions returns."""
        lines = body.split('\n')
        params_raw = []
        return {
            'name': name,
            'startLine': 1,
            'endLine': len(lines),
            'loc': len(lines),
            'params': params_raw,
            'body': body,
        }

    def test_long_function_warning(self):
        fn = self._make_fn('longFunc', SAMPLE_JS_LONG_FUNCTION, 'javascript')
        fn['loc'] = 58  # >50
        issues = run_linter([fn], SAMPLE_JS_LONG_FUNCTION, 'javascript')
        rules = [i['rule'] for i in issues]
        assert 'max-function-length' in rules

    def test_deep_nesting_warning(self):
        fn = self._make_fn('deeplyNested', SAMPLE_JS_DEEP_NESTING, 'javascript')
        issues = run_linter([fn], SAMPLE_JS_DEEP_NESTING, 'javascript')
        rules = [i['rule'] for i in issues]
        assert 'max-nesting-depth' in rules

    def test_too_many_params_warning(self):
        fn = self._make_fn('f', 'function f(a,b,c,d,e,f){}\n', 'javascript')
        fn['params'] = ['a', 'b', 'c', 'd', 'e', 'f']
        issues = run_linter([fn], '', 'javascript')
        rules = [i['rule'] for i in issues]
        assert 'max-params' in rules

    def test_no_issues_for_clean_code(self):
        fn = self._make_fn('greet', SAMPLE_JS_SIMPLE, 'javascript')
        fn['params'] = ['name']
        issues = run_linter([fn], SAMPLE_JS_SIMPLE, 'javascript')
        assert len(issues) == 0


# ════════════════════════════════════════════════════
# generate_refactor_suggestions()
# ════════════════════════════════════════════════════

class TestRefactorSuggestions:
    def _make_fn(self, name, body, language, params=None):
        lines = body.split('\n')
        return {
            'name': name,
            'startLine': 1,
            'endLine': len(lines),
            'loc': len(lines),
            'params': params or [],
            'body': body,
        }

    def test_high_complexity_suggestion(self):
        fn = self._make_fn('f', SAMPLE_JS_HIGH_COMPLEXITY, 'javascript')
        suggestions = generate_refactor_suggestions([fn], 'javascript')
        types = [s['type'] for s in suggestions]
        assert 'decompose' in types

    def test_many_params_suggestion(self):
        fn = self._make_fn('f', 'function f(){}\n', 'javascript',
                           params=['a', 'b', 'c', 'd', 'e', 'f'])
        suggestions = generate_refactor_suggestions([fn], 'javascript')
        types = [s['type'] for s in suggestions]
        assert 'parameter-object' in types

    def test_long_function_suggestion(self):
        fn = self._make_fn('longFunc', SAMPLE_JS_LONG_FUNCTION, 'javascript')
        suggestions = generate_refactor_suggestions([fn], 'javascript')
        types = [s['type'] for s in suggestions]
        assert 'extract-method' in types

    def test_clean_function_no_suggestions(self):
        fn = self._make_fn('greet', SAMPLE_JS_SIMPLE, 'javascript',
                           params=['name'])
        suggestions = generate_refactor_suggestions([fn], 'javascript')
        assert len(suggestions) == 0


# ════════════════════════════════════════════════════
# analyze_code() — end-to-end unit test
# ════════════════════════════════════════════════════

class TestAnalyzeCode:
    def test_js_analysis_structure(self):
        result = analyze_code(SAMPLE_JS_COMPLEX, "test.js")
        assert result['language'] == 'javascript'
        assert result['filename'] == 'test.js'
        assert 'summary' in result
        assert 'functions' in result
        assert 'linterIssues' in result
        assert 'refactorSuggestions' in result
        assert 'heatmap' in result

    def test_py_analysis_structure(self):
        result = analyze_code(SAMPLE_PY_COMPLEX, "test.py")
        assert result['language'] == 'python'
        assert len(result['functions']) >= 2

    def test_unknown_language_returns_error(self):
        result = analyze_code("SELECT 1;", "query.sql")
        assert result['language'] == 'unknown'
        assert 'error' in result

    def test_summary_metrics_present(self):
        result = analyze_code(SAMPLE_JS_SIMPLE, "test.js")
        summary = result['summary']
        assert 'loc' in summary
        assert 'sloc' in summary
        assert 'cyclomaticComplexity' in summary
        assert 'maintainabilityIndex' in summary
        assert 'halstead' in summary

    def test_heatmap_matches_functions(self):
        result = analyze_code(SAMPLE_JS_COMPLEX, "test.js")
        assert len(result['heatmap']) == len(result['functions'])
        for h in result['heatmap']:
            assert 'intensity' in h
            assert 'color' in h
