import json
import urllib.request

url = 'http://127.0.0.1:3001/api/predict'
data = json.dumps({'N': 50, 'P': 40, 'K': 30, 'ph': 6.5}).encode('utf-8')
req = urllib.request.Request(url, data, {'Content-Type': 'application/json'})
try:
    res = urllib.request.urlopen(req)
    print('Status:', res.status)
    print('Response:', res.read().decode())
except Exception as e:
    print('Error:', e)