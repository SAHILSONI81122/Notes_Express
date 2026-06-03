import urllib.request, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
# Free transparent fire GIF
url = "https://media.tenor.com/images/3d74c0c538a7c64a3e790a6e0e64032f/tenor.gif" 
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, context=ctx) as response:
        with open("assets/fire.gif", "wb") as f:
            f.write(response.read())
        print("Success")
except Exception as e:
    print(e)
