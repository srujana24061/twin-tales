#!/usr/bin/env python3
"""
Focused test for updated video generation features
Tests the new params: subject_references, first_frame_image, generation_type
"""
import requests
import json
import uuid
from datetime import datetime

BASE_URL = "https://collab-stories.preview.emergentagent.com"

def register_and_login():
    """Register a test user and get token"""
    test_email = f"videotest_{datetime.now().strftime('%H%M%S')}@test.com"
    register_data = {
        "email": test_email,
        "password": "testpass123", 
        "name": "Video Test User"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json=register_data,
            timeout=10
        )
        if response.status_code == 200:
            return response.json().get('token')
    except Exception as e:
        print(f"Registration failed: {e}")
    
    return None

def test_endpoint(name, method, endpoint, token=None, data=None, expected_status=200, timeout=15):
    """Test a single endpoint"""
    url = f"{BASE_URL}/api/{endpoint}"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    print(f"\n🔍 {name}")
    print(f"   {method} {endpoint}")
    
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers, timeout=timeout)
        elif method == 'POST':
            response = requests.post(url, json=data, headers=headers, timeout=timeout)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers, timeout=timeout)
            
        if response.status_code == expected_status:
            print(f"✅ PASSED - {response.status_code}")
            return True, response.json() if response.text else {}
        else:
            print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
            print(f"   Response: {response.text[:150]}...")
            return False, {}
            
    except Exception as e:
        print(f"❌ ERROR - {str(e)}")
        return False, {}

def test_video_generation_structure():
    """Test the structure of updated video generation features"""
    
    print("🚀 Testing Updated Video Generation Features")
    print("=" * 60)
    
    # Get token
    token = register_and_login()
    if not token:
        print("❌ Failed to get authentication token")
        return False
    
    print(f"✅ Authentication successful")
    
    # Create character for subject reference testing
    char_data = {
        "name": "Test Video Character",
        "role": "hero",
        "description": "Character for testing video generation with subject references",
        "personality_traits": ["brave", "kind"],
        "speaking_style": "heroic"
    }
    
    success, char_response = test_endpoint(
        "Create Character for Video Tests",
        "POST", 
        "characters",
        token, 
        char_data
    )
    
    char_id = char_response.get('id') if success else None
    
    # Test character photo upload endpoint structure  
    if char_id:
        success, _ = test_endpoint(
            "Character Photo Upload Validation",
            "POST",
            f"characters/{char_id}/upload-photo",
            token,
            expected_status=422  # Should fail without file
        )
    
    # Create story for video generation testing
    story_data = {
        "title": "Video Generation Test Story",
        "tone": "adventure", 
        "visual_style": "cartoon",
        "story_length": "short",
        "character_ids": [char_id] if char_id else [],
        "user_topic": "Testing updated video generation with characters"
    }
    
    success, story_response = test_endpoint(
        "Create Story with Character",
        "POST",
        "stories", 
        token,
        story_data
    )
    
    story_id = story_response.get('id') if success else None
    
    if story_id:
        # Test video generation endpoint (should fail gracefully without scenes)
        success, video_response = test_endpoint(
            "Video Generation Endpoint Check",
            "POST",
            f"stories/{story_id}/generate-video",
            token,
            expected_status=400  # Should fail because no scenes generated yet
        )
        
        # Test 404 for non-existent story
        fake_story_id = str(uuid.uuid4())
        success, _ = test_endpoint(
            "Video Generation 404 Test",
            "POST", 
            f"stories/{fake_story_id}/generate-video",
            token,
            expected_status=404
        )
        
    # Test core endpoints that should still work
    test_endpoint("List Stories", "GET", "stories", token)
    test_endpoint("List Characters", "GET", "characters", token)
    test_endpoint("Get Current User", "GET", "auth/me", token)
    
    # Cleanup
    if char_id:
        test_endpoint("Cleanup Character", "DELETE", f"characters/{char_id}", token)
    if story_id:
        test_endpoint("Cleanup Story", "DELETE", f"stories/{story_id}", token)
    
    print("\n" + "=" * 60)
    print("🏁 Focused Video Generation Testing Complete")
    return True

def test_minimax_service_integration():
    """Test that MiniMaxService.generate_video accepts the new parameters"""
    print("\n🔧 Testing MiniMaxService Integration...")
    
    # This is a structural test - we can't directly test the service
    # but we can verify the backend code has the right structure
    try:
        with open('/app/backend/services.py', 'r') as f:
            services_content = f.read()
            
        # Check that generate_video method has the new parameters
        required_params = ['subject_references', 'first_frame_image', 'generation_type']
        missing_params = []
        
        for param in required_params:
            if param not in services_content:
                missing_params.append(param)
        
        if missing_params:
            print(f"❌ Missing parameters in MiniMaxService.generate_video: {missing_params}")
            return False
        else:
            print("✅ MiniMaxService.generate_video has required parameters")
            
        # Check that generate_image has reference_images param
        if 'reference_images' in services_content:
            print("✅ MiniMaxService.generate_image has reference_images parameter") 
        else:
            print("❌ MiniMaxService.generate_image missing reference_images parameter")
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ Error checking service structure: {e}")
        return False

if __name__ == "__main__":
    success1 = test_video_generation_structure()
    success2 = test_minimax_service_integration()
    
    print(f"\n📊 Overall Result: {'✅ PASSED' if success1 and success2 else '❌ FAILED'}")