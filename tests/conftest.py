"""
Shared pytest fixtures for NoseyCoder backend tests.
"""
import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Add the backend directory to sys.path so we can import server module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))


# ─── Sample Code Fixtures ───

SAMPLE_JS_SIMPLE = '''\
function greet(name) {
    return "Hello, " + name;
}
'''

SAMPLE_JS_COMPLEX = '''\
function processOrder(items, user, config, discountRules, logger, metrics) {
    if (!items || items.length === 0) return { error: "No items" };
    let total = 0;
    for (const item of items) {
        if (item.price > 100 && user.isPremium) {
            if (discountRules.premiumDiscount > 0) {
                item.finalPrice = item.price * (1 - discountRules.premiumDiscount);
            } else {
                item.finalPrice = item.price;
            }
        } else if (item.quantity > 10) {
            if (config.bulkEnabled) {
                item.finalPrice = item.price * 0.9;
            } else {
                item.finalPrice = item.price;
            }
        } else {
            item.finalPrice = item.price;
        }
        total += item.finalPrice * item.quantity;
    }
    return { items, total: Math.round(total * 100) / 100 };
}

function validateItem(item) {
    if (!item.name) return false;
    if (item.price <= 0) return false;
    return true;
}
'''

SAMPLE_PY_SIMPLE = '''\
def greet(name):
    return f"Hello, {name}"
'''

SAMPLE_PY_COMPLEX = '''\
def process_pipeline(raw_data, config, validators, transformers):
    results = []
    errors = []
    for record in raw_data:
        if not record or not isinstance(record, dict):
            errors.append({"error": "Invalid record"})
            continue
        is_valid = True
        for validator in validators:
            if validator.type == "required":
                for field in validator.fields:
                    if field not in record:
                        is_valid = False
                        break
            elif validator.type == "range":
                if record.get(validator.field, 0) < validator.min_val:
                    is_valid = False
        if not is_valid:
            continue
        results.append(record)
    return {"results": results, "errors": errors}

def validate_config(config):
    if not config:
        return False
    if "pipeline_name" not in config:
        return False
    return True
'''

# Long function (>50 lines) for linter tests
SAMPLE_JS_LONG_FUNCTION = (
    'function longFunc() {\n'
    + '\n'.join(f'    let x{i} = {i};' for i in range(55))
    + '\n    return x0;\n}\n'
)

# Deeply nested function for linter tests
SAMPLE_JS_DEEP_NESTING = '''\
function deeplyNested(data) {
    if (data) {
        for (let i = 0; i < data.length; i++) {
            if (data[i].active) {
                for (let j = 0; j < data[i].items.length; j++) {
                    if (data[i].items[j].valid) {
                        console.log("deep");
                    }
                }
            }
        }
    }
}
'''

# High complexity function (many branches)
SAMPLE_JS_HIGH_COMPLEXITY = '''\
function highComplexity(a, b, c, d, e) {
    if (a > 0) { return 1; }
    else if (a < 0) { return -1; }
    if (b > 0 && c > 0) { return 2; }
    if (b < 0 || c < 0) { return -2; }
    for (let i = 0; i < d; i++) {
        if (i % 2 === 0) { continue; }
        switch (e) {
            case 1: return 10;
            case 2: return 20;
            case 3: return 30;
            case 4: return 40;
            case 5: return 50;
            default: return 0;
        }
    }
    while (a > 0 && b > 0) { a--; }
    return a ?? b ?? c;
}
'''
