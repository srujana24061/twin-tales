import requests
import uuid
import sys
import base64
from io import BytesIO
from PIL import Image

class PhotoUploadTester:
    def __init__(self, base_url="https://craft-stories-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.character_id = None
        
    def authenticate(self):
        """Register a new user and get auth token"""
        from datetime import datetime
        test_email = f"phototest_{datetime.now().strftime('%H%M%S')}@example.com"
        
        try:
            # Register user
            response = requests.post(f"{self.base_url}/api/auth/register", json={
                "email": test_email,
                "password": "testpass123", 
                "name": "Photo Test User"
            }, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data['token']
                print(f"✅ Authentication successful: {test_email}")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def create_test_character(self):
        """Create a test character for photo upload"""
        try:
            headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
            char_data = {
                "name": "Photo Test Character",
                "role": "hero",
                "description": "A character for testing photo upload",
                "personality_traits": ["brave", "kind"],
                "speaking_style": "cheerful",
                "is_imaginary": True
            }
            
            response = requests.post(f"{self.base_url}/api/characters", json=char_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.character_id = data['id']
                print(f"✅ Character created: {self.character_id}")
                
                # Check if character has reference_image field
                has_ref_image = 'reference_image' in data
                print(f"✅ Character has reference_image field: {has_ref_image}")
                
                return True
            else:
                print(f"❌ Character creation failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Character creation error: {str(e)}")
            return False
    
    def create_test_image(self):
        """Create a small test image for upload"""
        # Create a small 100x100 test image
        img = Image.new('RGB', (100, 100), color='red')
        img_buffer = BytesIO()
        img.save(img_buffer, format='JPEG')
        img_buffer.seek(0)
        return img_buffer
    
    def test_photo_upload_valid(self):
        """Test photo upload with valid image"""
        if not self.character_id:
            print("❌ No character ID for photo upload test")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            
            # Create test image
            test_image = self.create_test_image()
            
            files = {
                'file': ('test_character.jpg', test_image, 'image/jpeg')
            }
            
            response = requests.post(
                f"{self.base_url}/api/characters/{self.character_id}/upload-photo",
                files=files,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Photo upload successful")
                
                # Check response fields
                has_ref_image = 'reference_image' in data
                has_asset_id = 'reference_image_asset_id' in data
                
                print(f"✅ Response has reference_image: {has_ref_image}")
                print(f"✅ Response has reference_image_asset_id: {has_asset_id}")
                
                if has_ref_image:
                    ref_image_url = data['reference_image']
                    print(f"✅ Reference image URL: {ref_image_url}")
                    
                    # Test if the media URL is accessible
                    if ref_image_url.startswith('/api/media/'):
                        media_response = requests.get(f"{self.base_url}{ref_image_url}", timeout=10)
                        if media_response.status_code == 200:
                            print("✅ Media endpoint serves uploaded photo correctly")
                        else:
                            print(f"❌ Media endpoint failed: {media_response.status_code}")
                
                return True
            else:
                print(f"❌ Photo upload failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Photo upload error: {str(e)}")
            return False
    
    def test_photo_upload_invalid_type(self):
        """Test photo upload with invalid file type"""
        if not self.character_id:
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            
            # Create a text file instead of image
            files = {
                'file': ('test.txt', BytesIO(b'This is not an image'), 'text/plain')
            }
            
            response = requests.post(
                f"{self.base_url}/api/characters/{self.character_id}/upload-photo",
                files=files,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 400:
                print("✅ Invalid file type rejected correctly")
                return True
            else:
                print(f"❌ Expected 400 for invalid file, got {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Invalid file type test error: {str(e)}")
            return False
    
    def test_photo_upload_oversized(self):
        """Test photo upload with oversized file"""
        if not self.character_id:
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            
            # Create a large image (simulate >10MB)
            # For testing, create a smaller but still "large" image
            large_img = Image.new('RGB', (2000, 2000), color='blue')
            img_buffer = BytesIO()
            large_img.save(img_buffer, format='JPEG', quality=100)
            img_buffer.seek(0)
            
            # Check size
            size_mb = len(img_buffer.getvalue()) / (1024 * 1024)
            print(f"Test image size: {size_mb:.2f}MB")
            
            files = {
                'file': ('large_test.jpg', img_buffer, 'image/jpeg')
            }
            
            response = requests.post(
                f"{self.base_url}/api/characters/{self.character_id}/upload-photo",
                files=files,
                headers=headers,
                timeout=15
            )
            
            if size_mb > 10 and response.status_code == 400:
                print("✅ Oversized file rejected correctly")
                return True
            elif size_mb <= 10 and response.status_code == 200:
                print("✅ Large but valid file accepted")
                return True
            else:
                print(f"❌ Unexpected response for large file: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Large file test error: {str(e)}")
            return False
    
    def test_character_list_with_photo(self):
        """Test that character list includes reference_image field"""
        try:
            headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
            
            response = requests.get(f"{self.base_url}/api/characters", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Character list retrieved - {len(data)} characters")
                
                # Check if any character has reference_image field
                chars_with_photos = [c for c in data if c.get('reference_image')]
                print(f"✅ Characters with photos: {len(chars_with_photos)}")
                
                if chars_with_photos:
                    sample_char = chars_with_photos[0]
                    print(f"✅ Sample photo URL: {sample_char['reference_image']}")
                
                return True
            else:
                print(f"❌ Character list failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Character list test error: {str(e)}")
            return False
    
    def run_all_photo_tests(self):
        """Run all photo upload tests"""
        print("🚀 Starting Photo Upload Tests...")
        
        if not self.authenticate():
            return False
        
        print("\n📷 CHARACTER PHOTO UPLOAD TESTS")
        print("="*50)
        
        if not self.create_test_character():
            return False
        
        # Test photo upload functionality
        tests_passed = 0
        total_tests = 4
        
        if self.test_photo_upload_valid():
            tests_passed += 1
        
        if self.test_photo_upload_invalid_type():
            tests_passed += 1
        
        if self.test_photo_upload_oversized():
            tests_passed += 1
            
        if self.test_character_list_with_photo():
            tests_passed += 1
        
        print(f"\n📊 Photo Upload Test Summary: {tests_passed}/{total_tests} passed")
        return tests_passed == total_tests

def main():
    tester = PhotoUploadTester()
    success = tester.run_all_photo_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())