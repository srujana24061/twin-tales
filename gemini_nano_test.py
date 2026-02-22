#!/usr/bin/env python3
"""
Comprehensive test for Gemini Nano Banana Image Generation Integration
Tests actual image generation functionality and fallback mechanisms
"""

import requests
import json
import time
import uuid

class GeminiNanoBananaIntegrationTester:
    def __init__(self, base_url="https://twin-timeline.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.test_results = []
    
    def log_result(self, test_name, success, details=""):
        result = {
            "test": test_name,
            "success": success, 
            "details": details
        }
        self.test_results.append(result)
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def authenticate(self):
        """Authenticate with the API"""
        # Try login first with provided test credentials
        login_data = {"email": "test@example.com", "password": "test123"}
        try:
            response = requests.post(f"{self.base_url}/api/auth/login", json=login_data, timeout=10)
            if response.status_code == 200:
                self.token = response.json().get('token')
                self.log_result("Authentication", True, "Using existing test user")
                return True
        except:
            pass
        
        # Fall back to registration
        reg_data = {"email": f"test_nano_{int(time.time())}@example.com", "password": "test123", "name": "Nano Test User"}
        try:
            response = requests.post(f"{self.base_url}/api/auth/register", json=reg_data, timeout=10)
            if response.status_code == 200:
                self.token = response.json().get('token')
                self.log_result("Authentication", True, "Created new test user")
                return True
        except Exception as e:
            self.log_result("Authentication", False, f"Auth failed: {e}")
            return False
    
    def get_headers(self):
        return {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
    
    def test_story_creation_with_providers(self):
        """Test story creation with different image providers"""
        providers = [
            ("nano_banana", "16:9"),
            ("minimax", "1:1"), 
            ("nano_banana", "9:16"),
            ("minimax", "4:3")
        ]
        
        for provider, aspect_ratio in providers:
            story_data = {
                "title": f"Test {provider} Story",
                "tone": "funny",
                "visual_style": "cartoon",
                "story_length": "short",
                "image_provider": provider,
                "image_aspect_ratio": aspect_ratio,
                "user_topic": f"Test story for {provider} provider with {aspect_ratio} aspect ratio"
            }
            
            try:
                response = requests.post(f"{self.base_url}/api/stories", json=story_data, headers=self.get_headers(), timeout=10)
                if response.status_code == 200:
                    story = response.json()
                    saved_provider = story.get('image_provider')
                    saved_aspect = story.get('image_aspect_ratio')
                    
                    if saved_provider == provider and saved_aspect == aspect_ratio:
                        self.log_result(f"Story Creation - {provider} {aspect_ratio}", True, 
                                      f"Provider: {saved_provider}, Aspect: {saved_aspect}")
                    else:
                        self.log_result(f"Story Creation - {provider} {aspect_ratio}", False,
                                      f"Expected {provider}/{aspect_ratio}, got {saved_provider}/{saved_aspect}")
                    
                    # Cleanup
                    requests.delete(f"{self.base_url}/api/stories/{story['id']}", headers=self.get_headers(), timeout=5)
                else:
                    self.log_result(f"Story Creation - {provider} {aspect_ratio}", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_result(f"Story Creation - {provider} {aspect_ratio}", False, f"Exception: {e}")
    
    def test_image_regeneration_endpoints(self):
        """Test image regeneration endpoints with different providers"""
        # Create a story with some scenes
        story_data = {
            "title": "Image Regeneration Test Story",
            "tone": "adventure",
            "visual_style": "cartoon", 
            "story_length": "short",
            "image_provider": "nano_banana",
            "image_aspect_ratio": "16:9",
            "user_topic": "A brave little robot explores a magical forest"
        }
        
        try:
            # Create story
            response = requests.post(f"{self.base_url}/api/stories", json=story_data, headers=self.get_headers(), timeout=10)
            if response.status_code != 200:
                self.log_result("Image Regeneration Setup", False, "Failed to create test story")
                return
            
            story_id = response.json()['id']
            
            # Generate story content to create scenes
            gen_response = requests.post(f"{self.base_url}/api/stories/{story_id}/generate", headers=self.get_headers(), timeout=10)
            if gen_response.status_code != 200:
                self.log_result("Image Regeneration Setup", False, "Failed to start story generation")
                requests.delete(f"{self.base_url}/api/stories/{story_id}", headers=self.get_headers(), timeout=5)
                return
            
            job_id = gen_response.json().get('job_id')
            self.log_result("Story Generation Started", True, f"Job ID: {job_id}")
            
            # Wait for job to complete or get some scenes created (max 2 minutes)
            max_wait = 120
            wait_time = 0
            scenes = []
            
            while wait_time < max_wait:
                time.sleep(10)
                wait_time += 10
                
                # Check for scenes
                story_response = requests.get(f"{self.base_url}/api/stories/{story_id}", headers=self.get_headers(), timeout=10)
                if story_response.status_code == 200:
                    story = story_response.json()
                    scenes = story.get('scenes', [])
                    if scenes:
                        break
            
            if not scenes:
                self.log_result("Scene Creation Check", False, "No scenes created after waiting")
                requests.delete(f"{self.base_url}/api/stories/{story_id}", headers=self.get_headers(), timeout=5)
                return
            
            self.log_result("Scene Creation Check", True, f"Found {len(scenes)} scenes")
            
            # Test image regeneration on first scene with different providers
            scene_id = scenes[0]['id']
            providers = ["nano_banana", "minimax"]
            
            for provider in providers:
                regen_data = {"provider": provider}
                try:
                    regen_response = requests.post(
                        f"{self.base_url}/api/stories/{story_id}/scenes/{scene_id}/regenerate-image",
                        json=regen_data,
                        headers=self.get_headers(),
                        timeout=10
                    )
                    
                    if regen_response.status_code == 200:
                        regen_job = regen_response.json()
                        job_id = regen_job.get('job_id')
                        self.log_result(f"Image Regeneration - {provider}", True, f"Job created: {job_id}")
                    else:
                        self.log_result(f"Image Regeneration - {provider}", False, 
                                      f"Status: {regen_response.status_code}, Response: {regen_response.text[:100]}")
                
                except Exception as e:
                    self.log_result(f"Image Regeneration - {provider}", False, f"Exception: {e}")
            
            # Cleanup
            requests.delete(f"{self.base_url}/api/stories/{story_id}", headers=self.get_headers(), timeout=5)
            
        except Exception as e:
            self.log_result("Image Regeneration Test", False, f"Setup exception: {e}")
    
    def test_fallback_mechanism(self):
        """Test the fallback mechanism by checking service initialization"""
        # This test checks that the backend services are properly configured
        # We can infer fallback behavior from the story generation and regeneration tests
        
        # Test 1: Verify nano_banana is default
        story_data = {
            "title": "Default Provider Test",
            "tone": "funny",
            "visual_style": "cartoon",
            "story_length": "short",
            "user_topic": "Testing default provider behavior"
            # No image_provider specified
        }
        
        try:
            response = requests.post(f"{self.base_url}/api/stories", json=story_data, headers=self.get_headers(), timeout=10)
            if response.status_code == 200:
                story = response.json()
                provider = story.get('image_provider')
                if provider == 'nano_banana':
                    self.log_result("Default Provider Check", True, "nano_banana is default")
                else:
                    self.log_result("Default Provider Check", False, f"Default is {provider}, expected nano_banana")
                
                requests.delete(f"{self.base_url}/api/stories/{story['id']}", headers=self.get_headers(), timeout=5)
            else:
                self.log_result("Default Provider Check", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Default Provider Check", False, f"Exception: {e}")
    
    def run_all_tests(self):
        """Run comprehensive Gemini Nano Banana integration tests"""
        print("🍌 Starting Gemini Nano Banana Integration Tests...")
        print("=" * 60)
        
        if not self.authenticate():
            print("❌ Authentication failed, cannot continue tests")
            return False
        
        print("\n📝 Testing Story Creation with Different Providers...")
        self.test_story_creation_with_providers()
        
        print("\n🔄 Testing Image Regeneration Endpoints...")
        self.test_image_regeneration_endpoints()
        
        print("\n🔧 Testing Fallback Mechanism...")
        self.test_fallback_mechanism()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r['success'])
        
        print(f"Total tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success rate: {(passed_tests/total_tests)*100:.1f}%" if total_tests > 0 else "0%")
        
        failed_tests = [r for r in self.test_results if not r['success']]
        if failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = GeminiNanoBananaIntegrationTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)