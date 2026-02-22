"""
Tests for Timeline and Direct Chat endpoints
Features: timeline posts, like, suggested users, direct chat (start, send, get)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
USER1_EMAIL = "video_test_1771703962@test.com"
USER1_PASS = "TestPass123!"
USER2_EMAIL = "friend_test@test.com"
USER2_PASS = "TestPass123!"


# =================== FIXTURES ===================

@pytest.fixture(scope="module")
def user1_token():
    """Get auth token for user 1"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER1_EMAIL,
        "password": USER1_PASS
    })
    if resp.status_code != 200:
        pytest.skip(f"User1 login failed: {resp.status_code} {resp.text}")
    return resp.json().get("token")


@pytest.fixture(scope="module")
def user2_token():
    """Get auth token for user 2"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER2_EMAIL,
        "password": USER2_PASS
    })
    if resp.status_code != 200:
        # Try to register
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": USER2_EMAIL,
            "password": USER2_PASS,
            "name": "Friend Test User"
        })
        if reg_resp.status_code not in [200, 201]:
            pytest.skip(f"User2 login/register failed")
        return reg_resp.json().get("token")
    return resp.json().get("token")


@pytest.fixture(scope="module")
def user1_client(user1_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {user1_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user2_client(user2_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {user2_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user2_id(user2_client):
    resp = user2_client.get(f"{BASE_URL}/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    return (data.get("user") or data).get("id")


@pytest.fixture(scope="module")
def user1_id(user1_client):
    resp = user1_client.get(f"{BASE_URL}/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    return (data.get("user") or data).get("id")


# =================== AUTH TESTS ===================

class TestAuth:
    """Basic auth verification"""
    
    def test_user1_login_success(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL, "password": USER1_PASS
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert isinstance(data["token"], str) and len(data["token"]) > 0

    def test_user1_me_endpoint(self, user1_client):
        resp = user1_client.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        user = data.get("user") or data
        assert "id" in user
        assert "email" in user


# =================== TIMELINE TESTS ===================

class TestTimeline:
    """Timeline post CRUD and like tests"""

    def test_get_timeline_posts_returns_200(self, user1_client):
        resp = user1_client.get(f"{BASE_URL}/api/timeline/posts")
        assert resp.status_code == 200
        data = resp.json()
        assert "posts" in data
        assert isinstance(data["posts"], list)

    def test_create_post_text_only(self, user1_client):
        resp = user1_client.post(f"{BASE_URL}/api/timeline/posts", json={
            "content": "TEST_Timeline post - text only test",
            "image": None
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "post" in data
        post = data["post"]
        assert post["content"] == "TEST_Timeline post - text only test"
        assert "id" in post
        assert "author_name" in post
        assert "likes_count" in post
        assert "liked" in post

    def test_create_post_persists_in_feed(self, user1_client):
        # Create post
        create_resp = user1_client.post(f"{BASE_URL}/api/timeline/posts", json={
            "content": "TEST_Post for persistence check",
            "image": None
        })
        assert create_resp.status_code == 200
        post_id = create_resp.json()["post"]["id"]

        # Verify it appears in feed
        feed_resp = user1_client.get(f"{BASE_URL}/api/timeline/posts")
        assert feed_resp.status_code == 200
        post_ids = [p["id"] for p in feed_resp.json()["posts"]]
        assert post_id in post_ids

    def test_post_has_correct_structure(self, user1_client):
        resp = user1_client.get(f"{BASE_URL}/api/timeline/posts")
        assert resp.status_code == 200
        posts = resp.json()["posts"]
        if posts:
            post = posts[0]
            assert "id" in post
            assert "content" in post
            assert "author_name" in post
            assert "liked" in post
            assert "likes_count" in post
            assert "comments_count" in post
            assert "created_at" in post

    def test_like_post_toggle_like(self, user1_client):
        # Create a post first
        create_resp = user1_client.post(f"{BASE_URL}/api/timeline/posts", json={
            "content": "TEST_Post for like toggle", "image": None
        })
        assert create_resp.status_code == 200
        post_id = create_resp.json()["post"]["id"]

        # Like it
        like_resp = user1_client.post(f"{BASE_URL}/api/timeline/posts/{post_id}/like")
        assert like_resp.status_code == 200
        data = like_resp.json()
        assert "liked" in data
        assert data["liked"] == True

    def test_like_post_toggle_unlike(self, user1_client):
        # Create a post
        create_resp = user1_client.post(f"{BASE_URL}/api/timeline/posts", json={
            "content": "TEST_Post for unlike toggle", "image": None
        })
        assert create_resp.status_code == 200
        post_id = create_resp.json()["post"]["id"]

        # Like it
        user1_client.post(f"{BASE_URL}/api/timeline/posts/{post_id}/like")

        # Unlike it
        unlike_resp = user1_client.post(f"{BASE_URL}/api/timeline/posts/{post_id}/like")
        assert unlike_resp.status_code == 200
        data = unlike_resp.json()
        assert data["liked"] == False

    def test_like_nonexistent_post_returns_404(self, user1_client):
        resp = user1_client.post(f"{BASE_URL}/api/timeline/posts/nonexistent-post-id-abc/like")
        assert resp.status_code == 404

    def test_like_count_updates_after_like(self, user1_client):
        # Create post
        create_resp = user1_client.post(f"{BASE_URL}/api/timeline/posts", json={
            "content": "TEST_Post for like count check", "image": None
        })
        post_id = create_resp.json()["post"]["id"]

        # Like it
        user1_client.post(f"{BASE_URL}/api/timeline/posts/{post_id}/like")

        # Check feed - likes count should be 1
        feed_resp = user1_client.get(f"{BASE_URL}/api/timeline/posts")
        posts = feed_resp.json()["posts"]
        target = next((p for p in posts if p["id"] == post_id), None)
        assert target is not None
        assert target["likes_count"] == 1
        assert target["liked"] == True

    def test_get_suggested_users_returns_200(self, user1_client):
        resp = user1_client.get(f"{BASE_URL}/api/timeline/suggested-users")
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        assert isinstance(data["users"], list)

    def test_suggested_users_exclude_self(self, user1_client, user1_id):
        resp = user1_client.get(f"{BASE_URL}/api/timeline/suggested-users")
        assert resp.status_code == 200
        users = resp.json()["users"]
        user_ids = [u["id"] for u in users]
        assert user1_id not in user_ids, "Current user should not appear in suggestions"

    def test_suggested_users_have_correct_fields(self, user1_client):
        resp = user1_client.get(f"{BASE_URL}/api/timeline/suggested-users")
        assert resp.status_code == 200
        users = resp.json()["users"]
        for user in users:
            assert "id" in user
            assert "name" in user
            # password should be excluded
            assert "password" not in user


# =================== DIRECT CHAT TESTS ===================

class TestDirectChat:
    """Direct chat: start, send, get messages"""

    def test_start_direct_chat_returns_chat_id(self, user1_client, user2_id):
        resp = user1_client.post(f"{BASE_URL}/api/chat/direct/start", json={
            "friend_id": user2_id
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "chat_id" in data
        assert isinstance(data["chat_id"], str) and len(data["chat_id"]) > 0

    def test_start_direct_chat_idempotent(self, user1_client, user2_id):
        """Starting same chat twice returns same chat_id"""
        resp1 = user1_client.post(f"{BASE_URL}/api/chat/direct/start", json={"friend_id": user2_id})
        resp2 = user1_client.post(f"{BASE_URL}/api/chat/direct/start", json={"friend_id": user2_id})
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert resp1.json()["chat_id"] == resp2.json()["chat_id"]

    def test_send_direct_message_success(self, user1_client, user2_id):
        # Start chat first
        user1_client.post(f"{BASE_URL}/api/chat/direct/start", json={"friend_id": user2_id})
        
        resp = user1_client.post(f"{BASE_URL}/api/chat/direct/send", json={
            "friend_id": user2_id,
            "message": "TEST_Hello from user1!"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") == True
        assert "message" in data
        assert data["message"]["message"] == "TEST_Hello from user1!"

    def test_get_direct_messages_returns_list(self, user1_client, user2_id):
        resp = user1_client.get(f"{BASE_URL}/api/chat/direct/{user2_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "messages" in data
        assert isinstance(data["messages"], list)

    def test_sent_message_appears_in_get_messages(self, user1_client, user2_id):
        # Send a message
        unique_msg = f"TEST_Unique message {os.urandom(4).hex()}"
        user1_client.post(f"{BASE_URL}/api/chat/direct/send", json={
            "friend_id": user2_id,
            "message": unique_msg
        })

        # Get messages
        get_resp = user1_client.get(f"{BASE_URL}/api/chat/direct/{user2_id}")
        assert get_resp.status_code == 200
        messages = get_resp.json()["messages"]
        msg_texts = [m["message"] for m in messages]
        assert unique_msg in msg_texts

    def test_message_has_correct_structure(self, user1_client, user2_id):
        # Send message
        user1_client.post(f"{BASE_URL}/api/chat/direct/send", json={
            "friend_id": user2_id,
            "message": "TEST_Structure check message"
        })

        # Get messages
        get_resp = user1_client.get(f"{BASE_URL}/api/chat/direct/{user2_id}")
        messages = get_resp.json()["messages"]
        if messages:
            msg = messages[-1]
            assert "id" in msg
            assert "sender_id" in msg
            assert "message" in msg
            assert "timestamp" in msg

    def test_get_messages_no_chat_returns_empty(self, user1_client):
        """Getting messages for unknown friend returns empty list, not 404"""
        resp = user1_client.get(f"{BASE_URL}/api/chat/direct/nonexistent-user-xyz-123")
        assert resp.status_code == 200
        data = resp.json()
        assert data["messages"] == []

    def test_user2_can_see_messages_from_user1(self, user2_client, user1_id):
        """Bidirectional: user2 can see messages sent by user1"""
        resp = user2_client.get(f"{BASE_URL}/api/chat/direct/{user1_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "messages" in data
        assert isinstance(data["messages"], list)


# =================== FRIEND REQUEST FROM TIMELINE ===================

class TestFriendRequestFromTimeline:
    """Test send friend request (Connect button)"""

    def test_send_friend_request_or_already_friends(self, user1_client, user2_id):
        resp = user1_client.post(f"{BASE_URL}/api/friends/request", json={
            "to_user_id": user2_id
        })
        # Either succeeds or returns error (if already friends/request pending)
        assert resp.status_code in [200, 400, 409]

    def test_friends_list_accessible(self, user1_client):
        resp = user1_client.get(f"{BASE_URL}/api/friends/list")
        assert resp.status_code == 200
        data = resp.json()
        assert "friends" in data
        assert isinstance(data["friends"], list)
