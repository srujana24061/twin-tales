import requests
import json
import sys
from datetime import datetime

class StoryCraftAPITester:
    def __init__(self, base_url="https://storycraft-generator.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.test_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details="", priority="medium"):
        """Log test result"""
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "priority": priority,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        self.tests_run += 1
        if success:
            self.tests_passed += 1

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=True):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token and auth_required:
            headers['Authorization'] = f'Bearer {self.token}'

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                print(f"✅ PASSED - Status: {response.status_code}")
                try:
                    resp_json = response.json()
                    self.log_test(name, True, f"Status {response.status_code}, response keys: {list(resp_json.keys()) if isinstance(resp_json, dict) else 'array'}")
                except:
                    self.log_test(name, True, f"Status {response.status_code}")
                return True, response.json() if response.text else {}
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}: {response.text[:100]}", "high")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ FAILED - Request timeout")
            self.log_test(name, False, "Request timeout", "high")
            return False, {}
        except Exception as e:
            print(f"❌ FAILED - Error: {str(e)}")
            self.log_test(name, False, f"Exception: {str(e)}", "high")
            return False, {}

    def test_auth_register(self):
        """Test user registration"""
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@storycraft.com"
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={"email": test_email, "password": "testpass123", "name": "Test User"},
            auth_required=False
        )
        if success and 'token' in response and 'user' in response:
            self.token = response['token']
            self.test_user_id = response['user']['id']
            print(f"   🔑 Token acquired: {self.token[:20]}...")
            return True
        return False

    def test_auth_login(self):
        """Test user login with provided credentials"""
        success, response = self.run_test(
            "User Login (Provided Credentials)",
            "POST",
            "auth/login",
            200,
            data={"email": "testuser@storycraft.com", "password": "testpass123"},
            auth_required=False
        )
        if success and 'token' in response:
            self.token = response['token']
            self.test_user_id = response['user']['id']
            print(f"   🔑 Token acquired: {self.token[:20]}...")
            return True
        return False

    def test_auth_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_character_crud(self):
        """Test character CRUD operations"""
        # Create character
        char_data = {
            "name": "Test Hero",
            "role": "hero",
            "description": "A brave test character",
            "personality_traits": ["brave", "kind"],
            "speaking_style": "cheerful",
            "is_imaginary": True
        }
        success, char_response = self.run_test(
            "Create Character",
            "POST",
            "characters",
            200,
            data=char_data
        )
        if not success:
            return False

        char_id = char_response.get('id')
        if not char_id:
            print("❌ Character creation didn't return ID")
            self.log_test("Character ID Check", False, "No ID in create response", "high")
            return False

        # Get characters list
        success, _ = self.run_test(
            "List Characters",
            "GET",
            "characters",
            200
        )
        if not success:
            return False

        # Get single character
        success, _ = self.run_test(
            "Get Character",
            "GET",
            f"characters/{char_id}",
            200
        )
        if not success:
            return False

        # Update character
        update_data = {"name": "Updated Hero", "description": "Updated description"}
        success, _ = self.run_test(
            "Update Character",
            "PUT",
            f"characters/{char_id}",
            200,
            data=update_data
        )
        if not success:
            return False

        # Delete character
        success, _ = self.run_test(
            "Delete Character",
            "DELETE",
            f"characters/{char_id}",
            200
        )
        return success

    def test_story_crud(self):
        """Test story CRUD operations"""
        # Create story
        story_data = {
            "title": "Test Adventure",
            "tone": "funny",
            "visual_style": "cartoon",
            "story_length": "short",
            "user_topic": "A brave little mouse finds a magical cheese",
            "moral_theme": "courage"
        }
        success, story_response = self.run_test(
            "Create Story",
            "POST",
            "stories",
            200,
            data=story_data
        )
        if not success:
            return False

        story_id = story_response.get('id')
        if not story_id:
            print("❌ Story creation didn't return ID")
            self.log_test("Story ID Check", False, "No ID in create response", "high")
            return False

        # Get stories list
        success, _ = self.run_test(
            "List Stories",
            "GET",
            "stories",
            200
        )
        if not success:
            return False

        # Get single story
        success, _ = self.run_test(
            "Get Story",
            "GET",
            f"stories/{story_id}",
            200
        )
        if not success:
            return False

        # Test story generation endpoint (don't actually generate to save tokens)
        success, gen_response = self.run_test(
            "Story Generation Request",
            "POST",
            f"stories/{story_id}/generate",
            200
        )
        if success and 'job_id' in gen_response:
            job_id = gen_response['job_id']
            print(f"   📝 Job ID: {job_id}")
            
            # Test job status check
            success, _ = self.run_test(
                "Job Status Check",
                "GET",
                f"jobs/{job_id}",
                200
            )
        
        # Delete story
        success, _ = self.run_test(
            "Delete Story",
            "DELETE",
            f"stories/{story_id}",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        if success:
            expected_keys = ['stories', 'characters', 'total_jobs', 'completed_jobs']
            missing_keys = [k for k in expected_keys if k not in response]
            if missing_keys:
                print(f"❌ Missing stats keys: {missing_keys}")
                self.log_test("Dashboard Stats Structure", False, f"Missing keys: {missing_keys}", "medium")
                return False
        return success

    def test_pdf_generation_endpoint(self):
        """Test PDF generation endpoint structure (without actually generating)"""
        # First create a story
        story_data = {
            "title": "PDF Test Story",
            "tone": "funny",
            "visual_style": "cartoon",
            "story_length": "short",
            "user_topic": "Test topic for PDF"
        }
        success, story_response = self.run_test(
            "Create Story for PDF Test",
            "POST",
            "stories",
            200,
            data=story_data
        )
        if not success:
            return False

        story_id = story_response.get('id')
        # Test PDF generation endpoint (should return job)
        success, pdf_response = self.run_test(
            "PDF Generation Request",
            "POST",
            f"stories/{story_id}/generate-pdf",
            200
        )
        
        # Cleanup
        self.run_test("Cleanup PDF Test Story", "DELETE", f"stories/{story_id}", 200)
        return success

    def run_all_tests(self):
        """Run comprehensive API test suite"""
        print("🚀 Starting StoryCraft API Testing...")
        print(f"Base URL: {self.base_url}")
        
        # Test authentication flow first
        print("\n" + "="*50)
        print("🔐 AUTHENTICATION TESTS")
        print("="*50)
        
        if not self.test_auth_register():
            print("❌ Registration failed, trying login with provided credentials...")
            if not self.test_auth_login():
                print("❌ Both registration and login failed. Stopping tests.")
                return False
        
        if not self.test_auth_me():
            print("❌ Auth verification failed. Stopping tests.")
            return False

        # Test core functionality
        print("\n" + "="*50)
        print("👥 CHARACTER TESTS")
        print("="*50)
        self.test_character_crud()

        print("\n" + "="*50)
        print("📚 STORY TESTS")
        print("="*50)
        self.test_story_crud()

        print("\n" + "="*50)
        print("📊 DASHBOARD TESTS")
        print("="*50)
        self.test_dashboard_stats()

        print("\n" + "="*50)
        print("📄 PDF GENERATION TESTS")
        print("="*50)
        self.test_pdf_generation_endpoint()

        # Print summary
        print("\n" + "="*50)
        print("📈 TEST SUMMARY")
        print("="*50)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "0%")
        
        # Show failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"  - {test['test_name']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = StoryCraftAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())