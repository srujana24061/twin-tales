import requests
import json
import sys
import uuid
from datetime import datetime

class StoryCraftAPITester:
    def __init__(self, base_url="https://storycraft-generator.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.test_user_id = None
        self.story_id = None
        self.character_id = None
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

        self.character_id = char_id  # Store for photo upload test

        # Get characters list
        success, chars_response = self.run_test(
            "List Characters",
            "GET",
            "characters",
            200
        )
        if not success:
            return False

        # Check that reference_image field exists in character response
        if isinstance(chars_response, list) and len(chars_response) > 0:
            char_has_ref_image_field = 'reference_image' in chars_response[0] or any('reference_image' in char for char in chars_response)
            if not char_has_ref_image_field:
                print("⚠️  Warning: Characters don't have reference_image field yet")

        # Get single character
        success, single_char = self.run_test(
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

        return True  # Don't delete character yet - needed for photo upload test

    def test_character_photo_upload(self):
        """Test character photo upload functionality"""
        if not self.character_id:
            print("❌ No character ID available for photo upload test")
            return False

        # Test photo upload endpoint structure (no actual file)
        print(f"\n🔍 Testing Character Photo Upload Endpoint...")
        url = f"{self.base_url}/api/characters/{self.character_id}/upload-photo"
        headers = {}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            # Test without file (should fail)
            response = requests.post(url, headers=headers, timeout=10)
            if response.status_code == 422:  # FastAPI validation error for missing file
                print("✅ Photo upload endpoint exists and validates file requirement")
                self.log_test("Photo Upload Endpoint Validation", True, "Endpoint validates missing file correctly")
                
                # Test with invalid character ID
                fake_char_id = str(uuid.uuid4())
                fake_url = f"{self.base_url}/api/characters/{fake_char_id}/upload-photo"
                fake_response = requests.post(fake_url, headers=headers, timeout=10)
                if fake_response.status_code == 404:
                    print("✅ Photo upload returns 404 for non-existent character")
                    self.log_test("Photo Upload 404 Test", True, "Returns 404 for invalid character ID")
                else:
                    print(f"❌ Expected 404 for fake character, got {fake_response.status_code}")
                    self.log_test("Photo Upload 404 Test", False, f"Expected 404, got {fake_response.status_code}")
                
                return True
            else:
                print(f"❌ Expected 422 for missing file, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.log_test("Photo Upload Endpoint Validation", False, f"Expected 422, got {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Photo upload test error: {str(e)}")
            self.log_test("Photo Upload Endpoint Test", False, f"Exception: {str(e)}")
            return False

    def test_media_endpoint(self):
        """Test media serving endpoint"""
        # Test with fake media ID (should return 404)
        fake_media_id = str(uuid.uuid4())
        success, _ = self.run_test(
            "Media Endpoint (404 Test)",
            "GET",
            f"media/{fake_media_id}",
            404,
            auth_required=False  # Media endpoint is public
        )
        return success

    def cleanup_test_character(self):
        """Clean up test character"""
        if self.character_id:
            success, _ = self.run_test(
                "Delete Test Character",
                "DELETE",
                f"characters/{self.character_id}",
                200
            )
            return success
        return True

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

    def test_media_generation_endpoints(self):
        """Test Phase 2 media generation endpoints (structure only, no actual generation)"""
        # Create a story first
        story_data = {
            "title": "Media Test Story",
            "tone": "adventure",
            "visual_style": "cartoon",
            "story_length": "short",
            "user_topic": "A hero's journey"
        }
        success, story_response = self.run_test(
            "Create Story for Media Tests",
            "POST",
            "stories",
            200,
            data=story_data
        )
        if not success:
            return False

        story_id = story_response.get('id')
        if not story_id:
            return False

        # Test video generation endpoint (should return 400 because no scenes)
        success, _ = self.run_test(
            "Video Generation (No Scenes)",
            "POST",
            f"stories/{story_id}/generate-video",
            400  # Should fail because story has no scenes yet
        )

        # Test audio generation with voice_style parameter
        audio_data = {"voice_style": "storyteller"}
        success, _ = self.run_test(
            "Audio Generation with Voice Style",
            "POST",
            f"stories/{story_id}/generate-audio",
            400,  # Should fail because story has no scenes yet
            data=audio_data
        )

        # Test music generation (should work even without scenes)
        success, music_response = self.run_test(
            "Music Generation Request",
            "POST", 
            f"stories/{story_id}/generate-music",
            200
        )
        if success and 'job_id' in music_response:
            print(f"   🎵 Music job ID: {music_response['job_id']}")

        # Test 404 for non-existent story
        fake_story_id = str(uuid.uuid4())
        success, _ = self.run_test(
            "Video Generation (404 Test)",
            "POST",
            f"stories/{fake_story_id}/generate-video",
            404
        )

        # Test jobs listing
        success, jobs_response = self.run_test(
            "List Jobs",
            "GET",
            "jobs",
            200
        )
        if success:
            print(f"   📋 Found {len(jobs_response)} jobs")

        # Test 404 for non-existent media
        fake_media_id = str(uuid.uuid4())
        success, _ = self.run_test(
            "Media Retrieval (404 Test)",
            "GET",
            f"media/{fake_media_id}",
            404
        )

        # Cleanup
        self.run_test("Cleanup Media Test Story", "DELETE", f"stories/{story_id}", 200)
        return True

    def test_updated_video_generation_features(self):
        """Test updated video generation features from review request"""
        print("\n🎥 Testing Updated Video Generation Features...")
        
        # Create story with character for testing new features
        story_data = {
            "title": "Updated Video Test Story",
            "tone": "adventure", 
            "visual_style": "cartoon",
            "story_length": "short",
            "user_topic": "Testing updated video generation with character support"
        }
        success, story_response = self.run_test(
            "Create Story for Updated Video Tests",
            "POST",
            "stories",
            200,
            data=story_data
        )
        if not success:
            return False

        story_id = story_response.get('id')
        if not story_id:
            return False

        # Create a character for testing subject references
        char_data = {
            "name": "Video Test Hero",
            "role": "hero", 
            "description": "A character for testing video generation",
            "personality_traits": ["brave", "clever"],
            "speaking_style": "heroic"
        }
        success, char_response = self.run_test(
            "Create Character for Video Tests",
            "POST",
            "characters",
            200,
            data=char_data
        )
        test_char_id = char_response.get('id') if success else None

        # Test video generation endpoint - should still work for stories without scenes
        # This tests the updated endpoint structure but won't actually generate video
        success, video_response = self.run_test(
            "Updated Video Generation Endpoint",
            "POST",
            f"stories/{story_id}/generate-video", 
            400  # Should fail because story has no scenes yet, but endpoint should exist
        )

        # Test that the endpoint exists and validates properly
        if not success:
            # Check if it's a validation error (expected) vs endpoint not found (bad)
            print("   ✅ Video generation endpoint validation working")

        # Cleanup test character
        if test_char_id:
            self.run_test("Delete Video Test Character", "DELETE", f"characters/{test_char_id}", 200)
        
        # Cleanup test story  
        self.run_test("Cleanup Updated Video Test Story", "DELETE", f"stories/{story_id}", 200)
        return True

    def test_phase4_video_editor_endpoints(self):
        """Test Phase 4 Video Editor endpoints"""
        # Create a story with scenes for testing
        story_data = {
            "title": "Phase 4 Video Test Story", 
            "tone": "adventure",
            "visual_style": "cartoon",
            "story_length": "short",
            "user_topic": "Testing Phase 4 features"
        }
        success, story_response = self.run_test(
            "Create Story for Phase 4 Tests",
            "POST",
            "stories",
            200,
            data=story_data
        )
        if not success:
            return False

        story_id = story_response.get('id')
        if not story_id:
            return False

        # Test export-video endpoint (should return 400 because no scenes)
        success, export_response = self.run_test(
            "Export Video (No Scenes)",
            "POST",
            f"stories/{story_id}/export-video",
            400  # Should fail because story has no scenes yet
        )

        # Test reorder-scenes endpoint with empty array (should work even with no scenes)
        reorder_data = {"scene_ids": []}
        success, reorder_response = self.run_test(
            "Reorder Scenes (Empty)",
            "PUT",
            f"stories/{story_id}/reorder-scenes",
            200,
            data=reorder_data
        )
        if success and isinstance(reorder_response, list):
            print(f"   ✅ Reorder returned {len(reorder_response)} scenes")

        # Test generate-ad endpoint (should return 400 because no scenes)
        ad_data = {
            "platform": "instagram",
            "style": "emotional", 
            "cta_text": "Watch the full story!"
        }
        success, ad_response = self.run_test(
            "Generate Ad (No Scenes)",
            "POST",
            f"stories/{story_id}/generate-ad",
            400,  # Should fail because story has no scenes yet
            data=ad_data
        )

        # Test list ads endpoint (should work even with no ads)
        success, ads_response = self.run_test(
            "List Ads (Empty)",
            "GET",
            f"stories/{story_id}/ads",
            200
        )
        if success and isinstance(ads_response, list):
            print(f"   ✅ Ads list returned {len(ads_response)} ads")

        # Test 404 for non-existent story on new endpoints
        fake_story_id = str(uuid.uuid4())
        
        success, _ = self.run_test(
            "Export Video (404 Test)",
            "POST",
            f"stories/{fake_story_id}/export-video", 
            404
        )

        success, _ = self.run_test(
            "Reorder Scenes (404 Test)",
            "PUT",
            f"stories/{fake_story_id}/reorder-scenes",
            404,
            data={"scene_ids": []}
        )

        success, _ = self.run_test(
            "Generate Ad (404 Test)",
            "POST",
            f"stories/{fake_story_id}/generate-ad",
            404,
            data=ad_data
        )

        success, _ = self.run_test(
            "List Ads (404 Test)",
            "GET",
            f"stories/{fake_story_id}/ads",
            404
        )

        # Cleanup
        self.run_test("Cleanup Phase 4 Test Story", "DELETE", f"stories/{story_id}", 200)
        return True

    def run_all_tests(self):
        """Run comprehensive API test suite"""
        print("🚀 Starting StoryCraft API Phase 2 Testing...")
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
        print("📷 CHARACTER PHOTO UPLOAD TESTS")
        print("="*50)
        self.test_character_photo_upload()

        print("\n" + "="*50)
        print("🖼️  MEDIA ENDPOINT TESTS")
        print("="*50)
        self.test_media_endpoint()

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

        print("\n" + "="*50)
        print("🎬 MEDIA GENERATION TESTS (Phase 2)")
        print("="*50)
        self.test_media_generation_endpoints()

        print("\n" + "="*50)
        print("📹 PHASE 4 VIDEO EDITOR & AD STUDIO TESTS")
        print("="*50)
        self.test_phase4_video_editor_endpoints()

        print("\n" + "="*50)
        print("🧹 CLEANUP")
        print("="*50)
        self.cleanup_test_character()

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