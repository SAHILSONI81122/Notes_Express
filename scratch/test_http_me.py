import json
from urllib.request import Request, urlopen
from urllib.parse import urlencode

def main():
    url = "http://localhost:8000/login"
    data = urlencode({"username": "testuser_unique_123456@example.com", "password": "testpassword"}).encode("utf-8")
    req = Request(url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
    token = None
    try:
        with urlopen(req) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            token = res_data.get("access_token")
            print("Logged in successfully.")
    except Exception as e:
        print(f"Failed login: {e}")
        return
        
    # GET /me
    me_req = Request("http://localhost:8000/me", headers={"Authorization": f"Bearer {token}"})
    try:
        with urlopen(me_req) as response:
            profile = json.loads(response.read().decode("utf-8"))
            print("\n/me Profile response:")
            print(json.dumps(profile, indent=2))
    except Exception as e:
        print(f"Failed calling /me: {e}")

if __name__ == "__main__":
    main()
