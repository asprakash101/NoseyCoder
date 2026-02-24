#!/usr/bin/env python3
"""
CodeScope Backend API Test Suite
Tests all endpoints: /api/analyze, /api/health, /api/history
Validates JavaScript and Python code analysis functionality
"""

import requests
import json
import sys
from datetime import datetime

# Use the public URL for testing
BACKEND_URL = "https://github-metrics-hub.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class CodeScopeAPITester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"\n{status} - {name}")
        if details:
            print(f"   {details}")
        
        self.results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        try:
            response = requests.get(f"{API_BASE}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "status" in data and data["status"] == "ok":
                    self.log_test("Health endpoint", True, f"Status: {data.get('status')}, Service: {data.get('service', 'N/A')}")
                    return True
                else:
                    self.log_test("Health endpoint", False, f"Invalid response format: {data}")
                    return False
            else:
                self.log_test("Health endpoint", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Health endpoint", False, f"Connection error: {str(e)}")
            return False

    def test_javascript_analysis(self):
        """Test JavaScript code analysis via /api/analyze"""
        js_code = '''function processOrder(items, user, config, discountRules) {
    if (!items || items.length === 0) return { error: "No items" };
    
    let total = 0;
    let discountApplied = false;
    
    for (const item of items) {
        if (item.price > 100 && user.isPremium) {
            if (discountRules.premiumDiscount > 0) {
                item.finalPrice = item.price * (1 - discountRules.premiumDiscount);
                discountApplied = true;
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
}'''

        try:
            payload = {
                "code": js_code,
                "filename": "test.js"
            }
            
            response = requests.post(f"{API_BASE}/analyze", 
                                   json=payload,
                                   headers={"Content-Type": "application/json"},
                                   timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ['language', 'filename', 'summary', 'functions', 'linterIssues', 'refactorSuggestions', 'heatmap']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("JavaScript analysis", False, f"Missing fields: {missing_fields}")
                    return False
                
                # Check if it correctly identified JavaScript
                if data.get('language') != 'javascript':
                    self.log_test("JavaScript analysis", False, f"Language detection failed: {data.get('language')}")
                    return False
                
                # Check summary metrics
                summary = data.get('summary', {})
                if summary.get('functionCount', 0) < 2:
                    self.log_test("JavaScript analysis", False, f"Function detection failed: {summary.get('functionCount')} functions found")
                    return False
                
                # Check if functions were extracted
                functions = data.get('functions', [])
                if len(functions) < 2:
                    self.log_test("JavaScript analysis", False, f"Function extraction failed: {len(functions)} functions found")
                    return False
                
                # Check complexity calculation
                if summary.get('cyclomaticComplexity', 0) <= 1:
                    self.log_test("JavaScript analysis", False, f"Complexity calculation failed: CC={summary.get('cyclomaticComplexity')}")
                    return False
                
                self.log_test("JavaScript analysis", True, 
                             f"Language: {data['language']}, Functions: {len(functions)}, CC: {summary.get('cyclomaticComplexity')}, MI: {summary.get('maintainabilityIndex')}")
                return data
                
            else:
                self.log_test("JavaScript analysis", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("JavaScript analysis", False, f"Request error: {str(e)}")
            return False

    def test_python_analysis(self):
        """Test Python code analysis via /api/analyze"""
        python_code = '''def process_data_pipeline(raw_data, config, validators, transformers):
    """Process raw data through a configurable pipeline."""
    results = []
    errors = []
    
    for record in raw_data:
        if not record or not isinstance(record, dict):
            errors.append({"error": "Invalid record", "data": record})
            continue
            
        # Validate
        is_valid = True
        for validator in validators:
            if validator.type == "required":
                for field in validator.fields:
                    if field not in record:
                        is_valid = False
                        errors.append({"error": f"Missing {field}", "record": record.get("id")})
                        break
            elif validator.type == "range":
                if record.get(validator.field, 0) < validator.min_val:
                    is_valid = False
                elif record.get(validator.field, 0) > validator.max_val:
                    is_valid = False
        
        if not is_valid:
            continue
            
        # Transform
        for transformer in transformers:
            if transformer.condition and not transformer.condition(record):
                continue
            try:
                record = transformer.apply(record)
            except Exception as e:
                if config.get("strict_mode"):
                    raise
                else:
                    errors.append({"error": str(e), "record": record.get("id")})
                    
        results.append(record)
    
    return {"results": results, "errors": errors, "count": len(results)}

def validate_config(config):
    if not config:
        return False
    if "pipeline_name" not in config:
        return False
    return True'''

        try:
            payload = {
                "code": python_code,
                "filename": "test.py"
            }
            
            response = requests.post(f"{API_BASE}/analyze",
                                   json=payload,
                                   headers={"Content-Type": "application/json"},
                                   timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check language detection
                if data.get('language') != 'python':
                    self.log_test("Python analysis", False, f"Language detection failed: {data.get('language')}")
                    return False
                
                # Check function extraction
                functions = data.get('functions', [])
                if len(functions) < 2:
                    self.log_test("Python analysis", False, f"Function extraction failed: {len(functions)} functions found")
                    return False
                
                # Check summary
                summary = data.get('summary', {})
                if summary.get('functionCount', 0) < 2:
                    self.log_test("Python analysis", False, f"Function count mismatch: {summary.get('functionCount')}")
                    return False
                
                self.log_test("Python analysis", True,
                             f"Language: {data['language']}, Functions: {len(functions)}, CC: {summary.get('cyclomaticComplexity')}, MI: {summary.get('maintainabilityIndex')}")
                return data
                
            else:
                self.log_test("Python analysis", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Python analysis", False, f"Request error: {str(e)}")
            return False

    def test_invalid_code_handling(self):
        """Test how the API handles invalid/unsupported code"""
        try:
            # Test with unsupported file extension
            payload = {
                "code": "SELECT * FROM users;",
                "filename": "query.sql"
            }
            
            response = requests.post(f"{API_BASE}/analyze",
                                   json=payload,
                                   headers={"Content-Type": "application/json"},
                                   timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'error' in data and data.get('language') == 'unknown':
                    self.log_test("Invalid code handling", True, f"Correctly rejected unsupported language: {data.get('error')}")
                    return True
                else:
                    self.log_test("Invalid code handling", False, f"Should have rejected SQL file: {data}")
                    return False
            else:
                self.log_test("Invalid code handling", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Invalid code handling", False, f"Request error: {str(e)}")
            return False

    def test_history_endpoint(self):
        """Test /api/history endpoint"""
        try:
            response = requests.get(f"{API_BASE}/history", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Should return an array (might be empty initially)
                if isinstance(data, list):
                    self.log_test("History endpoint", True, f"Returned {len(data)} analysis records")
                    return True
                else:
                    self.log_test("History endpoint", False, f"Expected array, got: {type(data)}")
                    return False
            else:
                self.log_test("History endpoint", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("History endpoint", False, f"Request error: {str(e)}")
            return False

    def test_malformed_requests(self):
        """Test API error handling with malformed requests"""
        try:
            # Test missing required fields
            response = requests.post(f"{API_BASE}/analyze",
                                   json={"filename": "test.js"},  # Missing 'code' field
                                   headers={"Content-Type": "application/json"},
                                   timeout=10)
            
            if response.status_code in [400, 422]:  # Should return client error
                self.log_test("Malformed request handling", True, f"Correctly rejected malformed request: HTTP {response.status_code}")
                return True
            else:
                self.log_test("Malformed request handling", False, f"Should have rejected malformed request: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Malformed request handling", False, f"Request error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run complete backend test suite"""
        print("=" * 60)
        print("🔬 CodeScope Backend API Test Suite")
        print("=" * 60)
        print(f"Testing API at: {API_BASE}")
        
        # Run tests in order
        health_ok = self.test_health_endpoint()
        
        if health_ok:
            self.test_javascript_analysis()
            self.test_python_analysis()
            self.test_invalid_code_handling()
            self.test_history_endpoint()
            self.test_malformed_requests()
        else:
            print("\n❌ Health check failed - skipping other tests")
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("\n🎉 All tests passed!")
            return True
        else:
            print(f"\n⚠️  {self.tests_run - self.tests_passed} test(s) failed")
            return False

def main():
    """Main test runner"""
    tester = CodeScopeAPITester()
    success = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())