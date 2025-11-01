#!/usr/bin/env python3
"""
Backend API Testing for Smart Cooking Sync
Tests all endpoints according to the review request specifications
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://dish-planner-3.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def log_success(self, test_name):
        print(f"✅ {test_name}")
        self.passed += 1
        
    def log_failure(self, test_name, error):
        print(f"❌ {test_name}: {error}")
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} tests passed")
        if self.errors:
            print(f"\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{'='*60}")
        return self.failed == 0

def test_create_dish_1():
    """Test 1: POST /api/dishes - Create a new dish"""
    results = TestResults()
    
    dish_data = {
        "name": "Test Roast Chicken",
        "temperature": 200,
        "unit": "C",
        "cookingTime": 60,
        "ovenType": "Electric"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/dishes", json=dish_data, headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            required_fields = ['id', 'name', 'temperature', 'unit', 'cookingTime', 'ovenType', 'created_at']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                results.log_failure("Create dish response structure", f"Missing fields: {missing_fields}")
            else:
                # Verify data matches input
                if (data['name'] == dish_data['name'] and 
                    data['temperature'] == dish_data['temperature'] and
                    data['unit'] == dish_data['unit'] and
                    data['cookingTime'] == dish_data['cookingTime'] and
                    data['ovenType'] == dish_data['ovenType']):
                    
                    # Verify UUID format (basic check)
                    if len(data['id']) == 36 and data['id'].count('-') == 4:
                        results.log_success("Create dish - all validations passed")
                        return results, data['id']  # Return dish ID for later tests
                    else:
                        results.log_failure("Create dish UUID validation", f"Invalid UUID format: {data['id']}")
                else:
                    results.log_failure("Create dish data validation", "Response data doesn't match input")
        else:
            results.log_failure("Create dish HTTP status", f"Expected 200, got {response.status_code}: {response.text}")
            
    except Exception as e:
        results.log_failure("Create dish request", f"Exception: {str(e)}")
        
    return results, None

def test_get_all_dishes():
    """Test 2: GET /api/dishes - Get all dishes"""
    results = TestResults()
    
    try:
        response = requests.get(f"{BACKEND_URL}/dishes", headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            
            if isinstance(data, list):
                if len(data) >= 1:  # Should have at least the dish from test 1
                    # Check if our test dish is in the list
                    test_dish_found = any(dish['name'] == 'Test Roast Chicken' for dish in data)
                    if test_dish_found:
                        results.log_success("Get all dishes - found test dish")
                    else:
                        results.log_failure("Get all dishes", "Test dish not found in response")
                else:
                    results.log_failure("Get all dishes", "No dishes returned")
            else:
                results.log_failure("Get all dishes response format", "Response is not a list")
        else:
            results.log_failure("Get all dishes HTTP status", f"Expected 200, got {response.status_code}: {response.text}")
            
    except Exception as e:
        results.log_failure("Get all dishes request", f"Exception: {str(e)}")
        
    return results

def test_create_multiple_dishes():
    """Test 3: POST /api/dishes - Create multiple dishes for cooking plan test"""
    results = TestResults()
    
    dishes = [
        {"name": "Salmon", "temperature": 180, "unit": "C", "cookingTime": 20, "ovenType": "Fan"},
        {"name": "Vegetables", "temperature": 200, "unit": "C", "cookingTime": 30, "ovenType": "Electric"},
        {"name": "Potatoes", "temperature": 220, "unit": "C", "cookingTime": 45, "ovenType": "Gas"}
    ]
    
    created_ids = []
    
    for i, dish_data in enumerate(dishes, 1):
        try:
            response = requests.post(f"{BACKEND_URL}/dishes", json=dish_data, headers=HEADERS)
            
            if response.status_code == 200:
                data = response.json()
                created_ids.append(data['id'])
                results.log_success(f"Create dish {i} ({dish_data['name']})")
            else:
                results.log_failure(f"Create dish {i} HTTP status", f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            results.log_failure(f"Create dish {i} request", f"Exception: {str(e)}")
    
    return results, created_ids

def test_cooking_plan_calculate():
    """Test 4: POST /api/cooking-plan/calculate - Calculate optimal cooking plan"""
    results = TestResults()
    
    plan_request = {"user_oven_type": "Fan"}
    
    try:
        response = requests.post(f"{BACKEND_URL}/cooking-plan/calculate", json=plan_request, headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            required_fields = ['optimal_temp', 'adjusted_dishes', 'total_time']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                results.log_failure("Cooking plan response structure", f"Missing fields: {missing_fields}")
            else:
                # Verify optimal_temp is rounded to nearest 10
                if data['optimal_temp'] % 10 == 0:
                    results.log_success("Cooking plan - optimal temp rounded to nearest 10")
                else:
                    results.log_failure("Cooking plan optimal temp", f"Not rounded to nearest 10: {data['optimal_temp']}")
                
                # Verify adjusted_dishes structure
                if isinstance(data['adjusted_dishes'], list) and len(data['adjusted_dishes']) > 0:
                    dish_fields = ['id', 'name', 'originalTemp', 'adjustedTemp', 'originalTime', 'adjustedTime', 'order']
                    first_dish = data['adjusted_dishes'][0]
                    missing_dish_fields = [field for field in dish_fields if field not in first_dish]
                    
                    if missing_dish_fields:
                        results.log_failure("Cooking plan dish structure", f"Missing dish fields: {missing_dish_fields}")
                    else:
                        results.log_success("Cooking plan - dish structure valid")
                        
                        # Verify dishes are sorted by adjusted time (longest first)
                        times = [dish['adjustedTime'] for dish in data['adjusted_dishes']]
                        if times == sorted(times, reverse=True):
                            results.log_success("Cooking plan - dishes sorted by time (longest first)")
                        else:
                            results.log_failure("Cooking plan sorting", f"Dishes not sorted by time: {times}")
                        
                        # Verify total_time matches max adjusted time
                        max_time = max(times)
                        if data['total_time'] == max_time:
                            results.log_success("Cooking plan - total_time matches max adjusted time")
                        else:
                            results.log_failure("Cooking plan total_time", f"Expected {max_time}, got {data['total_time']}")
                else:
                    results.log_failure("Cooking plan adjusted_dishes", "No adjusted dishes returned")
                    
        else:
            results.log_failure("Cooking plan HTTP status", f"Expected 200, got {response.status_code}: {response.text}")
            
    except Exception as e:
        results.log_failure("Cooking plan request", f"Exception: {str(e)}")
        
    return results

def test_delete_specific_dish(dish_id):
    """Test 5: DELETE /api/dishes/{dish_id} - Delete specific dish"""
    results = TestResults()
    
    if not dish_id:
        results.log_failure("Delete specific dish", "No dish ID provided from create test")
        return results
    
    try:
        response = requests.delete(f"{BACKEND_URL}/dishes/{dish_id}", headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'message' in data and 'id' in data:
                if data['id'] == dish_id:
                    results.log_success("Delete specific dish - response valid")
                    
                    # Verify dish is actually deleted by trying to get all dishes
                    get_response = requests.get(f"{BACKEND_URL}/dishes", headers=HEADERS)
                    if get_response.status_code == 200:
                        dishes = get_response.json()
                        dish_still_exists = any(dish['id'] == dish_id for dish in dishes)
                        if not dish_still_exists:
                            results.log_success("Delete specific dish - verified removal from database")
                        else:
                            results.log_failure("Delete specific dish verification", "Dish still exists in database")
                    else:
                        results.log_failure("Delete specific dish verification", "Could not verify deletion")
                else:
                    results.log_failure("Delete specific dish response", f"ID mismatch: expected {dish_id}, got {data['id']}")
            else:
                results.log_failure("Delete specific dish response structure", "Missing message or id field")
        else:
            results.log_failure("Delete specific dish HTTP status", f"Expected 200, got {response.status_code}: {response.text}")
            
    except Exception as e:
        results.log_failure("Delete specific dish request", f"Exception: {str(e)}")
        
    return results

def test_clear_all_dishes():
    """Test 6: DELETE /api/dishes - Clear all dishes"""
    results = TestResults()
    
    try:
        response = requests.delete(f"{BACKEND_URL}/dishes", headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'message' in data and 'deleted_count' in data:
                results.log_success(f"Clear all dishes - deleted {data['deleted_count']} dishes")
                
                # Verify all dishes are actually deleted
                get_response = requests.get(f"{BACKEND_URL}/dishes", headers=HEADERS)
                if get_response.status_code == 200:
                    dishes = get_response.json()
                    if len(dishes) == 0:
                        results.log_success("Clear all dishes - verified database is empty")
                    else:
                        results.log_failure("Clear all dishes verification", f"Database still has {len(dishes)} dishes")
                else:
                    results.log_failure("Clear all dishes verification", "Could not verify deletion")
            else:
                results.log_failure("Clear all dishes response structure", "Missing message or deleted_count field")
        else:
            results.log_failure("Clear all dishes HTTP status", f"Expected 200, got {response.status_code}: {response.text}")
            
    except Exception as e:
        results.log_failure("Clear all dishes request", f"Exception: {str(e)}")
        
    return results

def test_cooking_plan_no_dishes():
    """Test 7: POST /api/cooking-plan/calculate with no dishes - Error handling"""
    results = TestResults()
    
    plan_request = {"user_oven_type": "Fan"}
    
    try:
        response = requests.post(f"{BACKEND_URL}/cooking-plan/calculate", json=plan_request, headers=HEADERS)
        
        if response.status_code == 400:
            data = response.json()
            
            if 'detail' in data and data['detail'] == "No dishes found":
                results.log_success("Cooking plan no dishes - correct error response")
            else:
                results.log_failure("Cooking plan no dishes error message", f"Expected 'No dishes found', got: {data}")
        else:
            results.log_failure("Cooking plan no dishes HTTP status", f"Expected 400, got {response.status_code}: {response.text}")
            
    except Exception as e:
        results.log_failure("Cooking plan no dishes request", f"Exception: {str(e)}")
        
    return results

def main():
    """Run all backend API tests in sequence"""
    print("🚀 Starting Smart Cooking Sync Backend API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now().isoformat()}")
    print("="*60)
    
    all_results = TestResults()
    
    # Test 1: Create first dish
    print("\n1. Testing POST /api/dishes - Create Test Roast Chicken")
    test1_results, first_dish_id = test_create_dish_1()
    all_results.passed += test1_results.passed
    all_results.failed += test1_results.failed
    all_results.errors.extend(test1_results.errors)
    
    # Test 2: Get all dishes
    print("\n2. Testing GET /api/dishes - Get all dishes")
    test2_results = test_get_all_dishes()
    all_results.passed += test2_results.passed
    all_results.failed += test2_results.failed
    all_results.errors.extend(test2_results.errors)
    
    # Test 3: Create multiple dishes
    print("\n3. Testing POST /api/dishes - Create multiple dishes")
    test3_results, created_ids = test_create_multiple_dishes()
    all_results.passed += test3_results.passed
    all_results.failed += test3_results.failed
    all_results.errors.extend(test3_results.errors)
    
    # Test 4: Calculate cooking plan
    print("\n4. Testing POST /api/cooking-plan/calculate - Calculate optimal plan")
    test4_results = test_cooking_plan_calculate()
    all_results.passed += test4_results.passed
    all_results.failed += test4_results.failed
    all_results.errors.extend(test4_results.errors)
    
    # Test 5: Delete specific dish
    print("\n5. Testing DELETE /api/dishes/{dish_id} - Delete specific dish")
    test5_results = test_delete_specific_dish(first_dish_id)
    all_results.passed += test5_results.passed
    all_results.failed += test5_results.failed
    all_results.errors.extend(test5_results.errors)
    
    # Test 6: Clear all dishes
    print("\n6. Testing DELETE /api/dishes - Clear all dishes")
    test6_results = test_clear_all_dishes()
    all_results.passed += test6_results.passed
    all_results.failed += test6_results.failed
    all_results.errors.extend(test6_results.errors)
    
    # Test 7: Cooking plan with no dishes
    print("\n7. Testing POST /api/cooking-plan/calculate - No dishes error handling")
    test7_results = test_cooking_plan_no_dishes()
    all_results.passed += test7_results.passed
    all_results.failed += test7_results.failed
    all_results.errors.extend(test7_results.errors)
    
    # Final summary
    success = all_results.summary()
    
    if success:
        print("\n🎉 All backend API tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some backend API tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()