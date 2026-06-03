import urllib.request
import ssl
url = "https://raw.githubusercontent.com/LottieFiles/lottie-react-native/master/example/assets/PinJump.json" # wait, I need a fire lottie
# let's try a different repo:
url = "https://raw.githubusercontent.com/sonnylab/sonnylab.github.io/master/assets/images/fire.json"
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, context=ctx) as response:
        print("Found:", len(response.read()))
except Exception as e:
    print(f"Failed: {e}")
