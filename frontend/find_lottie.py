import urllib.request, json, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
url = "https://api.github.com/search/code?q=filename:fire.json+in:path+%22assets%22+size:5000..50000"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, context=ctx) as response:
        data = json.loads(response.read())
        if 'items' in data and data['items']:
            item = data['items'][0]
            raw_url = item['html_url'].replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
            print("Found URL:", raw_url)
            
            with urllib.request.urlopen(urllib.request.Request(raw_url, headers={'User-Agent': 'Mozilla/5.0'}), context=ctx) as r:
                with open("assets/fire.json", "wb") as f:
                    f.write(r.read())
                print("Downloaded to assets/fire.json")
except Exception as e:
    print(e)
