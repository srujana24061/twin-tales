"""
Backend tests for:
- Auth: register & login
- Standalone PUT /scenes/{scene_id}
- POST /scenes/{scene_id}/generate-image
- POST /scenes/{scene_id}/generate-video
- POST /stories/{story_id}/batch-generate-videos
- GET /notifications
- GET /wellbeing/settings (parent_email field)
- PUT /wellbeing/settings with parent_email
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


# ===== Auth Tests =====

class TestAuth:
    """Authentication endpoint tests"""
    TEST_EMAIL = f"test_scene_{int(time.time())}@test.com"
    TEST_PASSWORD = "TestPass123!"
    TEST_NAME = "Scene Test User"
    TEST_PHONE = "+1234567890"

    def test_register_new_user(self):
        """Register a new user with name, email, password, and phone"""
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.TEST_EMAIL,
            "password": self.TEST_PASSWORD,
            "name": self.TEST_NAME,
            "phone": self.TEST_PHONE
        })
        assert resp.status_code == 200, f"Register failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "token" in data, "No token in register response"
        assert "user" in data, "No user in register response"
        assert data["user"]["email"] == self.TEST_EMAIL
        assert data["user"]["name"] == self.TEST_NAME
        print(f"PASS: Register - {data['user']['email']}")

    def test_login_registered_user(self):
        """Login the registered user"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.TEST_EMAIL,
            "password": self.TEST_PASSWORD
        })
        assert resp.status_code == 200, f"Login failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "token" in data, "No token in login response"
        assert "user" in data, "No user in login response"
        assert data["user"]["email"] == self.TEST_EMAIL
        print(f"PASS: Login - token present, user: {data['user']['email']}")

    def test_login_invalid_credentials(self):
        """Login with bad password should return 401"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.TEST_EMAIL,
            "password": "wrongpassword"
        })
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("PASS: Login invalid credentials returns 401")


# ===== Fixtures for authenticated tests =====

@pytest.fixture(scope="module")
def auth_token():
    """Register a fresh user and return auth token"""
    email = f"test_scene_auth_{int(time.time())}@test.com"
    resp = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": "TestPass123!",
        "name": "Test Scene User"
    })
    if resp.status_code != 200:
        pytest.skip(f"Auth failed: {resp.status_code} - {resp.text}")
    data = resp.json()
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="module")
def story_and_scene(auth_headers):
    """Create a story to get valid scene IDs for testing"""
    # Create character first
    char_resp = requests.post(f"{BASE_URL}/api/characters", json={
        "name": "TEST_TestHero",
        "role": "hero",
        "description": "A brave hero"
    }, headers=auth_headers)
    
    if char_resp.status_code != 200:
        pytest.skip(f"Could not create character: {char_resp.text}")
    
    char_id = char_resp.json().get("id")
    
    # Create story
    story_resp = requests.post(f"{BASE_URL}/api/stories", json={
        "title": "TEST_Scene Grid Story",
        "story_type": "original",
        "tone": "funny",
        "visual_style": "cartoon",
        "user_topic": "A short adventure",
        "character_ids": [char_id] if char_id else [],
        "story_length": "short"
    }, headers=auth_headers)
    
    if story_resp.status_code not in [200, 201]:
        pytest.skip(f"Could not create story: {story_resp.text}")
    
    story = story_resp.json()
    story_id = story.get("id")
    
    # Get scenes
    scenes_resp = requests.get(f"{BASE_URL}/api/stories/{story_id}/scenes", headers=auth_headers)
    if scenes_resp.status_code != 200:
        pytest.skip(f"Could not get scenes: {scenes_resp.text}")
    
    scenes = scenes_resp.json()
    if not scenes:
        pytest.skip("No scenes created with story")
    
    return {"story_id": story_id, "scenes": scenes, "first_scene_id": scenes[0]["id"]}


# ===== PUT /scenes/{scene_id} Tests =====

class TestSceneUpdate:
    """Tests for standalone PUT /scenes/{scene_id} endpoint"""

    def test_update_nonexistent_scene_returns_404(self, auth_headers):
        """PUT on nonexistent scene should return 404"""
        resp = requests.put(f"{BASE_URL}/api/scenes/nonexistent_fake_id_12345", 
                            json={"scene_text": "Updated text"},
                            headers=auth_headers)
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print("PASS: PUT nonexistent scene returns 404")

    def test_update_scene_unauthorized_returns_403(self, auth_headers, story_and_scene):
        """PUT on scene belonging to another user should return 403"""
        # Register a different user
        other_email = f"other_user_{int(time.time())}@test.com"
        other_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": other_email,
            "password": "TestPass123!",
            "name": "Other User"
        })
        if other_resp.status_code != 200:
            pytest.skip("Could not create other user")
        
        other_token = other_resp.json()["token"]
        other_headers = {"Authorization": f"Bearer {other_token}"}
        
        scene_id = story_and_scene["first_scene_id"]
        resp = requests.put(f"{BASE_URL}/api/scenes/{scene_id}",
                            json={"scene_text": "Hacked text"},
                            headers=other_headers)
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print("PASS: PUT unauthorized scene returns 403")

    def test_update_scene_text_success(self, auth_headers, story_and_scene):
        """Update scene text with valid scene ID should work"""
        scene_id = story_and_scene["first_scene_id"]
        new_text = "Updated scene text for testing"
        
        resp = requests.put(f"{BASE_URL}/api/scenes/{scene_id}",
                            json={"scene_text": new_text},
                            headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert data.get("scene_text") == new_text, f"scene_text not updated: {data}"
        print(f"PASS: Scene text updated to: {new_text}")


# ===== Generate Image Tests =====

class TestGenerateImage:
    """Tests for POST /scenes/{scene_id}/generate-image"""

    def test_generate_image_nonexistent_scene_returns_404(self, auth_headers):
        """POST generate-image on nonexistent scene should return 404"""
        resp = requests.post(f"{BASE_URL}/api/scenes/nonexistent_id_abc123/generate-image",
                             headers=auth_headers)
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print("PASS: generate-image nonexistent scene returns 404")

    def test_generate_image_returns_image_url(self, auth_headers, story_and_scene):
        """POST generate-image on valid scene should return 200 with image_url"""
        scene_id = story_and_scene["first_scene_id"]
        resp = requests.post(f"{BASE_URL}/api/scenes/{scene_id}/generate-image",
                             headers=auth_headers,
                             timeout=120)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "image_url" in data, f"No image_url in response: {data}"
        assert data["image_url"], "image_url is empty"
        assert data.get("success") == True
        print(f"PASS: generate-image returned image_url: {data['image_url'][:80]}...")


# ===== Generate Video Tests =====

class TestGenerateVideo:
    """Tests for POST /scenes/{scene_id}/generate-video"""

    def test_generate_video_no_image_returns_400(self, auth_headers, story_and_scene):
        """POST generate-video on scene without image should return 400"""
        # Create a new scene-less story to get a scene without image
        # Use second scene if available, else skip
        scenes = story_and_scene["scenes"]
        scene_without_image = next((s for s in scenes if not s.get("image_url")), None)
        if not scene_without_image:
            pytest.skip("All scenes have images - cannot test 400 case")
        
        resp = requests.post(f"{BASE_URL}/api/scenes/{scene_without_image['id']}/generate-video",
                             headers=auth_headers)
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print("PASS: generate-video without image returns 400")

    def test_generate_video_valid_scene_starts_job(self, auth_headers, story_and_scene):
        """POST generate-video on scene with image should start job (requires image from prev test)"""
        # Get the scene (should have image from generate_image test)
        scene_id = story_and_scene["first_scene_id"]
        
        # Check if scene has image
        scene_resp = requests.get(f"{BASE_URL}/api/stories/{story_and_scene['story_id']}/scenes", 
                                  headers=auth_headers)
        scenes = scene_resp.json()
        scene = next((s for s in scenes if s["id"] == scene_id), None)
        
        if not scene or not scene.get("image_url"):
            pytest.skip("Scene doesn't have image yet - depends on generate-image test passing first")
        
        resp = requests.post(f"{BASE_URL}/api/scenes/{scene_id}/generate-video",
                             headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "job_id" in data, f"No job_id in response: {data}"
        assert data.get("status") == "pending"
        print(f"PASS: generate-video started job: {data['job_id']}")


# ===== Batch Generate Videos Tests =====

class TestBatchGenerateVideos:
    """Tests for POST /stories/{story_id}/batch-generate-videos"""

    def test_batch_generate_no_images_returns_400(self, auth_headers):
        """POST batch-generate-videos with no scenes with images should return 400"""
        # Create a story with no images
        story_resp = requests.post(f"{BASE_URL}/api/stories", json={
            "title": "TEST_No Images Story",
            "story_type": "original",
            "tone": "funny",
            "visual_style": "cartoon",
            "user_topic": "Short test",
            "story_length": "short"
        }, headers=auth_headers)
        
        if story_resp.status_code not in [200, 201]:
            pytest.skip(f"Could not create story: {story_resp.text}")
        
        story_id = story_resp.json().get("id")
        
        resp = requests.post(f"{BASE_URL}/api/stories/{story_id}/batch-generate-videos",
                             headers=auth_headers)
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "detail" in data
        print(f"PASS: batch-generate-videos with no images returns 400: {data['detail']}")

    def test_batch_generate_nonexistent_story_returns_404(self, auth_headers):
        """POST batch-generate-videos for nonexistent story returns 404"""
        resp = requests.post(f"{BASE_URL}/api/stories/fake_story_id_xyz/batch-generate-videos",
                             headers=auth_headers)
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print("PASS: batch-generate-videos nonexistent story returns 404")


# ===== Notifications Tests =====

class TestNotifications:
    """Tests for GET /api/notifications"""

    def test_get_notifications_authenticated(self, auth_headers):
        """GET notifications should return array for authenticated user"""
        resp = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got: {type(data)}"
        print(f"PASS: notifications returned array with {len(data)} items")

    def test_get_notifications_unauthenticated_returns_401(self):
        """GET notifications without auth should return 401"""
        resp = requests.get(f"{BASE_URL}/api/notifications")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
        print("PASS: notifications without auth returns 401")


# ===== Wellbeing Settings Tests =====

class TestWellbeingSettings:
    """Tests for GET/PUT /wellbeing/settings with parent_email"""

    def test_get_wellbeing_settings_returns_parent_email_field(self, auth_headers):
        """GET wellbeing settings should return object including parent_email field"""
        resp = requests.get(f"{BASE_URL}/api/wellbeing/settings", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, dict), f"Expected dict, got: {type(data)}"
        assert "parent_email" in data, f"parent_email field missing from settings: {data.keys()}"
        print(f"PASS: wellbeing settings has parent_email field: {data.get('parent_email')}")

    def test_put_wellbeing_settings_with_parent_email(self, auth_headers):
        """PUT wellbeing settings with parent_email should save and read back correctly"""
        test_email = f"parent_{int(time.time())}@test.com"
        
        # Save with parent_email
        put_resp = requests.put(f"{BASE_URL}/api/wellbeing/settings", json={
            "parent_email": test_email,
            "session_cap_minutes": 30,
            "session_cap_enabled": True
        }, headers=auth_headers)
        assert put_resp.status_code == 200, f"PUT failed: {put_resp.status_code}: {put_resp.text}"
        print(f"PASS: PUT wellbeing settings - saved parent_email: {test_email}")

        # Read back and verify
        get_resp = requests.get(f"{BASE_URL}/api/wellbeing/settings", headers=auth_headers)
        assert get_resp.status_code == 200, f"GET failed: {get_resp.status_code}"
        data = get_resp.json()
        assert data.get("parent_email") == test_email, \
            f"parent_email not persisted. Expected: {test_email}, Got: {data.get('parent_email')}"
        print(f"PASS: parent_email reads back correctly: {data['parent_email']}")

    def test_wellbeing_settings_unauthenticated_returns_401(self):
        """GET wellbeing settings without auth should return 401"""
        resp = requests.get(f"{BASE_URL}/api/wellbeing/settings")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("PASS: wellbeing settings without auth returns 401")
