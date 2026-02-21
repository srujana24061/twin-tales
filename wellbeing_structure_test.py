"""
Simple Wellbeing Backend Structure Test - No AI Dependency
Tests the wellbeing endpoints without triggering expensive AI calls
"""
import requests
import json
from datetime import datetime, timezone

# Configuration
BASE_URL = "https://storycraft-ai-87.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test user credentials
TEST_EMAIL = "wellbeing_test@test.com"
TEST_PASSWORD = "Test1234!"

def test_wellbeing_endpoints_structure():
    """Test that all wellbeing endpoints are available and respond correctly"""
    
    # Login first
    session = requests.Session()
    login_data = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
    response = session.post(f"{API_BASE}/auth/login", json=login_data)
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        return False
        
    data = response.json()
    token = data.get("access_token") or data.get("token")
    session.headers.update({"Authorization": f"Bearer {token}"})
    print(f"✅ Login successful")
    
    # Test endpoints without AI calls
    endpoints = [
        ("GET", "/wellbeing/settings", "Session settings"),
        ("PUT", "/wellbeing/settings", "Update settings", {"session_cap_minutes": 25}),
        ("GET", "/wellbeing/checkin/today", "Today's check-in status"),
        ("GET", "/wellbeing/reflections", "User reflections"),
        ("POST", "/parent/set-pin", "Set parent PIN", {"pin": "1234"}),
    ]
    
    results = {}
    
    for method, endpoint, description, *payload in endpoints:
        try:
            url = f"{API_BASE}{endpoint}"
            
            if method == "GET":
                resp = session.get(url)
            elif method == "POST":
                resp = session.post(url, json=payload[0] if payload else {})
            elif method == "PUT":
                resp = session.put(url, json=payload[0] if payload else {})
            
            if resp.status_code in [200, 201]:
                print(f"✅ {description}: {resp.status_code}")
                results[endpoint] = True
            else:
                print(f"❌ {description}: {resp.status_code} - {resp.text[:100]}")
                results[endpoint] = False
                
        except Exception as e:
            print(f"❌ {description}: Error - {e}")
            results[endpoint] = False
    
    # Test parent authentication
    try:
        resp = session.post(f"{API_BASE}/parent/verify-pin", json={"pin": "1234"})
        if resp.status_code == 200:
            parent_token = resp.json().get("parent_token")
            
            # Test parent dashboard with parent token
            parent_headers = {"Authorization": f"Bearer {parent_token}"}
            resp = requests.get(f"{API_BASE}/parent/dashboard", headers=parent_headers)
            
            if resp.status_code == 200:
                print("✅ Parent dashboard access: 200")
                results["/parent/dashboard"] = True
            else:
                print(f"❌ Parent dashboard access: {resp.status_code}")
                results["/parent/dashboard"] = False
        else:
            print(f"❌ Parent PIN verification: {resp.status_code}")
            results["/parent/verify-pin"] = False
            
    except Exception as e:
        print(f"❌ Parent auth test error: {e}")
        results["/parent/verify-pin"] = False
    
    success_count = sum(results.values())
    total = len(results)
    success_rate = (success_count / total) * 100 if total > 0 else 0
    
    print(f"\n📊 Results: {success_count}/{total} endpoints working ({success_rate:.1f}%)")
    
    return success_rate >= 80

if __name__ == "__main__":
    print("🧪 Testing Wellbeing Backend Structure (No AI calls)")
    success = test_wellbeing_endpoints_structure()
    print(f"\n{'✅ BACKEND STRUCTURE TESTS PASSED' if success else '❌ BACKEND STRUCTURE TESTS FAILED'}")