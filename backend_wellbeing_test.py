"""
Comprehensive Backend Testing for StoryCraft AI Wellbeing Features
Tests the "Healthy Engagement & Parent Dashboard" functionality
"""
import asyncio
import requests
import json
from datetime import datetime, timezone, timedelta

# Configuration
BASE_URL = "https://twin-timeline.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test user credentials as specified in review request
TEST_EMAIL = "wellbeing_test@test.com"
TEST_PASSWORD = "Test1234!"
TEST_NAME = "TestChild"

class WellbeingTester:
    def __init__(self):
        self.session = requests.Session()
        self.user_token = None
        self.parent_token = None
        self.user_id = None
        self.session_id = None
        self.story_id = None
        
    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
        
    def register_and_login_user(self):
        """Register and login test user"""
        self.log("🔐 TESTING: User Registration & Login")
        
        # First try to register
        try:
            register_data = {
                "name": TEST_NAME,
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
            response = self.session.post(f"{API_BASE}/auth/register", json=register_data)
            if response.status_code == 201:
                self.log("✅ User registration successful")
            elif response.status_code == 200:
                # Some APIs return 200 with token on registration
                data = response.json()
                if "token" in data or "access_token" in data:
                    self.log("✅ User registration successful (with token)")
                    # Extract token immediately
                    self.user_token = data.get("access_token") or data.get("token")
                    self.user_id = data.get("user_id") or (data.get("user", {}).get("id"))
                    if self.user_token:
                        self.session.headers.update({"Authorization": f"Bearer {self.user_token}"})
                        self.log(f"✅ Auto-login successful. User ID: {self.user_id}")
                        return True
            elif response.status_code == 400:
                self.log("ℹ️  User already exists, proceeding to login")
            else:
                self.log(f"❌ Registration failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log(f"❌ Registration error: {e}")
            
        # If we already have a token from registration, no need to login
        if self.user_token:
            return True
            
        # Now login
        try:
            login_data = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                # Try both possible token fields
                self.user_token = data.get("access_token") or data.get("token")
                self.user_id = data.get("user_id") or (data.get("user", {}).get("id"))
                
                if not self.user_token:
                    self.log(f"❌ No token in response: {data}")
                    return False
                    
                self.session.headers.update({"Authorization": f"Bearer {self.user_token}"})
                self.log(f"✅ Login successful. User ID: {self.user_id}")
                self.log(f"✅ Token: {self.user_token[:20]}...")
                return True
            else:
                self.log(f"❌ Login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Login error: {e}")
            return False
    
    def test_session_settings(self):
        """Test session settings endpoints"""
        self.log("\n⚙️  TESTING: Session Settings")
        
        try:
            # Test GET settings (should return default values)
            response = self.session.get(f"{API_BASE}/wellbeing/settings")
            if response.status_code == 200:
                settings = response.json()
                self.log(f"✅ GET settings successful: {json.dumps(settings, indent=2)}")
                
                # Verify default settings
                assert settings.get("session_cap_minutes") == 25, f"Expected 25 min cap, got {settings.get('session_cap_minutes')}"
                assert settings.get("session_cap_enabled") == True, f"Expected cap enabled, got {settings.get('session_cap_enabled')}"
                self.log("✅ Default settings verified (25 min cap, enabled)")
                
            else:
                self.log(f"❌ GET settings failed: {response.status_code} - {response.text}")
                return False
                
            # Test PUT settings (update to 30 minutes, disabled)
            update_data = {
                "session_cap_minutes": 30,
                "session_cap_enabled": False
            }
            response = self.session.put(f"{API_BASE}/wellbeing/settings", json=update_data)
            if response.status_code == 200:
                self.log("✅ PUT settings successful")
                
                # Verify the update persisted
                response = self.session.get(f"{API_BASE}/wellbeing/settings")
                if response.status_code == 200:
                    updated_settings = response.json()
                    assert updated_settings.get("session_cap_minutes") == 30, "Settings update failed - minutes"
                    assert updated_settings.get("session_cap_enabled") == False, "Settings update failed - enabled"
                    self.log("✅ Settings update verified in database")
                    return True
                else:
                    self.log(f"❌ Failed to verify settings update: {response.status_code}")
                    return False
            else:
                self.log(f"❌ PUT settings failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Session settings test error: {e}")
            return False
    
    def test_wellbeing_checkin_flow(self):
        """Test the complete wellbeing check-in flow"""
        self.log("\n🌟 TESTING: Wellbeing Check-in Flow")
        
        try:
            # Step 1: Start check-in
            self.log("Step 1: Starting check-in session...")
            response = self.session.post(f"{API_BASE}/wellbeing/checkin/start")
            
            if response.status_code == 200:
                data = response.json()
                self.session_id = data.get("session_id")
                already_completed = data.get("already_completed", False)
                
                if already_completed:
                    self.log("ℹ️  Check-in already completed today, testing existing data...")
                    self.log(f"✅ Today's mood score: {data.get('mood_score')}")
                    self.log(f"✅ Mood tags: {data.get('mood_tags', [])}")
                    self.log(f"✅ Story suggestions: {len(data.get('story_suggestions', []))} suggestions")
                    return True
                else:
                    messages = data.get("messages", [])
                    self.log(f"✅ Check-in started. Session ID: {self.session_id}")
                    self.log(f"✅ Luna's first message: {messages[0].get('content') if messages else 'No message'}")
                    
            else:
                self.log(f"❌ Start check-in failed: {response.status_code} - {response.text}")
                return False
                
            # Step 2: Send 3 child responses to complete the flow
            child_responses = [
                "I'm feeling pretty good today!",
                "I had fun playing with my friends at lunch",
                "I'm excited to create a story about dragons"
            ]
            
            for i, response_text in enumerate(child_responses, 1):
                self.log(f"Step 2.{i}: Sending child response '{response_text}'...")
                
                response = self.session.post(f"{API_BASE}/wellbeing/checkin/respond", json={
                    "session_id": self.session_id,
                    "message": response_text
                })
                
                if response.status_code == 200:
                    data = response.json()
                    completed = data.get("completed", False)
                    
                    if completed:
                        self.log(f"✅ Check-in completed after {i} exchanges!")
                        self.log(f"✅ Mood score: {data.get('mood_score')}")
                        self.log(f"✅ Mood tags: {data.get('mood_tags', [])}")
                        self.log(f"✅ Summary: {data.get('summary', 'No summary')}")
                        
                        story_suggestions = data.get('story_suggestions', [])
                        self.log(f"✅ Story suggestions received: {len(story_suggestions)} suggestions")
                        for idx, suggestion in enumerate(story_suggestions[:3]):  # Show first 3
                            self.log(f"   - Suggestion {idx+1}: {suggestion.get('theme')} ({suggestion.get('tone')})")
                        
                        break
                    else:
                        luna_message = data.get("luna_message", "")
                        self.log(f"✅ Luna responded: '{luna_message[:50]}...'")
                        
                else:
                    self.log(f"❌ Respond failed: {response.status_code} - {response.text}")
                    return False
            
            # Step 3: Verify today's check-in data
            self.log("Step 3: Verifying today's check-in data...")
            response = self.session.get(f"{API_BASE}/wellbeing/checkin/today")
            
            if response.status_code == 200:
                data = response.json()
                has_checkin = data.get("has_checkin", False)
                
                if has_checkin:
                    self.log("✅ Today's check-in data retrieved successfully")
                    self.log(f"✅ Completed: {data.get('completed', False)}")
                    self.log(f"✅ Mood score: {data.get('mood_score', 'N/A')}")
                    return True
                else:
                    self.log("❌ No check-in data found for today")
                    return False
            else:
                self.log(f"❌ Get today's check-in failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Wellbeing check-in flow error: {e}")
            return False
    
    def test_parent_pin_setup_and_auth(self):
        """Test parent PIN setup and authentication"""
        self.log("\n🔒 TESTING: Parent PIN Setup & Authentication")
        
        try:
            # Step 1: Set parent PIN
            test_pin = "1234"
            self.log(f"Step 1: Setting parent PIN to '{test_pin}'...")
            
            response = self.session.post(f"{API_BASE}/parent/set-pin", json={"pin": test_pin})
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ PIN setup successful: {data.get('message')}")
            else:
                self.log(f"❌ PIN setup failed: {response.status_code} - {response.text}")
                return False
                
            # Step 2: Test correct PIN verification
            self.log("Step 2: Verifying correct PIN...")
            response = self.session.post(f"{API_BASE}/parent/verify-pin", json={"pin": test_pin})
            
            if response.status_code == 200:
                data = response.json()
                self.parent_token = data.get("parent_token")
                self.log("✅ Correct PIN verification successful")
                self.log(f"✅ Parent token received: {self.parent_token[:20]}...")
                
                # Verify token has is_parent claim
                import jwt
                try:
                    # We can't decode without the secret, but we can verify the response structure
                    if self.parent_token and len(self.parent_token.split('.')) == 3:
                        self.log("✅ Parent token format is valid (JWT structure)")
                    else:
                        self.log("❌ Invalid parent token format")
                        return False
                except Exception as e:
                    self.log(f"⚠️  Could not validate JWT structure: {e}")
                    
            else:
                self.log(f"❌ Correct PIN verification failed: {response.status_code} - {response.text}")
                return False
                
            # Step 3: Test incorrect PIN verification
            self.log("Step 3: Testing incorrect PIN...")
            response = self.session.post(f"{API_BASE}/parent/verify-pin", json={"pin": "9999"})
            
            if response.status_code == 401:
                self.log("✅ Incorrect PIN properly rejected (401)")
            else:
                self.log(f"❌ Incorrect PIN should return 401, got: {response.status_code}")
                return False
                
            return True
            
        except Exception as e:
            self.log(f"❌ Parent PIN test error: {e}")
            return False
    
    def test_parent_dashboard_analytics(self):
        """Test parent dashboard analytics"""
        self.log("\n📊 TESTING: Parent Dashboard Analytics")
        
        if not self.parent_token:
            self.log("❌ No parent token available, skipping dashboard test")
            return False
            
        try:
            # Test parent dashboard access
            headers = {"Authorization": f"Bearer {self.parent_token}"}
            response = self.session.get(f"{API_BASE}/parent/dashboard", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.log("✅ Parent dashboard access successful")
                
                # Verify required data structure
                required_keys = ["user", "summary", "mood_trend", "detected_concerns", "recent_reflections", "recent_sessions", "settings"]
                for key in required_keys:
                    if key in data:
                        self.log(f"✅ Dashboard contains '{key}' data")
                    else:
                        self.log(f"❌ Missing required dashboard data: '{key}'")
                        return False
                
                # Check specific data
                summary = data.get("summary", {})
                self.log(f"✅ Summary stats: {json.dumps(summary, indent=2)}")
                
                mood_trend = data.get("mood_trend", [])
                self.log(f"✅ Mood trend data: {len(mood_trend)} days")
                
                settings = data.get("settings", {})
                self.log(f"✅ Settings: cap={settings.get('session_cap_minutes')}min, enabled={settings.get('session_cap_enabled')}")
                
                return True
                
            elif response.status_code == 403:
                self.log("❌ Parent dashboard returned 403 - token lacks is_parent claim")
                return False
            else:
                self.log(f"❌ Parent dashboard failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Parent dashboard test error: {e}")
            return False
    
    def test_reflections(self):
        """Test reflection creation and retrieval"""
        self.log("\n💭 TESTING: Reflections")
        
        try:
            # Create a test reflection
            # Note: We need a story_id, so we'll create one or use a mock ID
            test_story_id = "test-story-123"  # Mock ID for testing
            reflection_data = {
                "story_id": test_story_id,
                "mood_emoji": "happy",
                "what_i_liked": "I loved the brave dragon character!",
                "what_i_learned": "I learned that being brave means helping others."
            }
            
            self.log("Step 1: Creating a story reflection...")
            response = self.session.post(f"{API_BASE}/wellbeing/reflections", json=reflection_data)
            
            if response.status_code == 200:
                data = response.json()
                reflection_id = data.get("id")
                self.log(f"✅ Reflection created successfully. ID: {reflection_id}")
            else:
                self.log(f"❌ Reflection creation failed: {response.status_code} - {response.text}")
                return False
                
            # Retrieve reflections
            self.log("Step 2: Retrieving user reflections...")
            response = self.session.get(f"{API_BASE}/wellbeing/reflections")
            
            if response.status_code == 200:
                reflections = response.json()
                self.log(f"✅ Retrieved {len(reflections)} reflections")
                
                if reflections:
                    latest = reflections[0]
                    self.log(f"✅ Latest reflection: mood={latest.get('mood_emoji')}, story={latest.get('story_id')}")
                
                return True
            else:
                self.log(f"❌ Reflection retrieval failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Reflections test error: {e}")
            return False
    
    def test_unauthorized_access(self):
        """Test that parent endpoints require proper authorization"""
        self.log("\n🛡️  TESTING: Unauthorized Access Prevention")
        
        try:
            # Test parent dashboard without parent token (should fail)
            headers = {"Authorization": f"Bearer {self.user_token}"}  # Regular user token
            response = self.session.get(f"{API_BASE}/parent/dashboard", headers=headers)
            
            if response.status_code == 403:
                self.log("✅ Parent dashboard properly rejects regular user token (403)")
            else:
                self.log(f"❌ Parent dashboard should return 403 for regular user, got: {response.status_code}")
                return False
                
            # Test parent dashboard without any token (should fail)
            response = requests.get(f"{API_BASE}/parent/dashboard")  # No headers
            
            if response.status_code == 401:
                self.log("✅ Parent dashboard properly rejects no token (401)")
            else:
                self.log(f"❌ Parent dashboard should return 401 for no token, got: {response.status_code}")
                return False
                
            return True
            
        except Exception as e:
            self.log(f"❌ Unauthorized access test error: {e}")
            return False
    
    def run_all_tests(self):
        """Run comprehensive backend tests for wellbeing features"""
        self.log("🚀 STARTING COMPREHENSIVE WELLBEING BACKEND TESTS")
        self.log(f"Testing against: {BASE_URL}")
        self.log(f"Test user: {TEST_EMAIL}\n")
        
        results = {}
        
        # Test 1: User Registration & Login
        results["user_auth"] = self.register_and_login_user()
        
        if not results["user_auth"]:
            self.log("❌ Cannot continue tests without user authentication")
            return results
        
        # Test 2: Session Settings
        results["session_settings"] = self.test_session_settings()
        
        # Test 3: Wellbeing Check-in Flow
        results["checkin_flow"] = self.test_wellbeing_checkin_flow()
        
        # Test 4: Parent PIN Setup & Authentication
        results["parent_auth"] = self.test_parent_pin_setup_and_auth()
        
        # Test 5: Parent Dashboard Analytics
        results["parent_dashboard"] = self.test_parent_dashboard_analytics()
        
        # Test 6: Reflections
        results["reflections"] = self.test_reflections()
        
        # Test 7: Unauthorized Access Prevention
        results["security"] = self.test_unauthorized_access()
        
        # Summary
        self.log("\n" + "="*60)
        self.log("📋 TEST RESULTS SUMMARY:")
        self.log("="*60)
        
        passed = 0
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.replace('_', ' ').title()}: {status}")
            if result:
                passed += 1
        
        success_rate = (passed / total) * 100
        self.log(f"\nOverall: {passed}/{total} tests passed ({success_rate:.1f}%)")
        
        if success_rate == 100:
            self.log("🎉 ALL TESTS PASSED! Wellbeing backend is fully functional.")
        elif success_rate >= 80:
            self.log("⚠️  Most tests passed, but some issues need attention.")
        else:
            self.log("❌ Critical issues found. Backend needs fixes.")
            
        return results

if __name__ == "__main__":
    tester = WellbeingTester()
    results = tester.run_all_tests()