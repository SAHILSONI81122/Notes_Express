import urllib.request
import urllib.parse
import json

BASE_URL = "http://localhost:8000"

def test_signup_login():
    # 1. Signup a new user
    signup_data = {
        "name": "Test User",
        "email": "testuser_unique_123456@example.com",
        "password": "testpassword",
        "role": "student"
    }
    
    print("Testing signup...")
    try:
        req = urllib.request.Request(
            f"{BASE_URL}/signup",
            data=json.dumps(signup_data).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            print("Signup response:", res_body)
    except Exception as e:
        print("Signup error:", e)
        return

    # 2. Login the new user
    login_data = {
        "username": signup_data["email"],
        "password": signup_data["password"]
    }
    encoded_data = urllib.parse.urlencode(login_data).encode("utf-8")
    
    print("\nTesting login...")
    try:
        req = urllib.request.Request(
            f"{BASE_URL}/login",
            data=encoded_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            print("Login response:", res_body)
            token = json.loads(res_body)["access_token"]
    except Exception as e:
        print("Login error:", e)
        return

    # 3. Test /me
    print("\nTesting /me...")
    try:
        req = urllib.request.Request(
            f"{BASE_URL}/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            print("Me response:", res_body)
    except Exception as e:
        print("Me error:", e)

if __name__ == "__main__":
    test_signup_login()
