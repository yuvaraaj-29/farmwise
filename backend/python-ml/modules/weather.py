import urllib.request
import json
import time
import math
from datetime import datetime, timezone
_CACHE = {}
_CACHE_TTL_SECONDS = 3600  # 1 hour
def _cache_key(lat, lon):
    date_str = datetime.utcnow().strftime('%Y-%m-%d-%H')
    return f"{round(lat, 2)},{round(lon, 2)},{date_str}"
def _cached(lat, lon):
    key = _cache_key(lat, lon)
    entry = _CACHE.get(key)
    if entry and (time.time() - entry['ts'] < _CACHE_TTL_SECONDS):
        return entry['data']
    return None
def _store_cache(lat, lon, data):
    key = _cache_key(lat, lon)
    _CACHE[key] = {'data': data, 'ts': time.time()}
_MONTHLY_INDIA = {
    1:  (18, 55,  10),
    2:  (21, 50,  15),
    3:  (26, 48,  12),
    4:  (31, 45,  20),
    5:  (34, 48,  35),
    6:  (33, 75, 165),
    7:  (30, 85, 300),
    8:  (29, 85, 280),
    9:  (29, 80, 195),
    10: (27, 72,  70),
    11: (23, 62,  30),
    12: (19, 58,  15),
}
def _fallback_weather():
    month = datetime.utcnow().month
    temp, hum, rain_monthly = _MONTHLY_INDIA[month]
    rain_daily = round(rain_monthly / 30, 1)
    return {
        'temperature': float(temp),
        'humidity':    float(hum),
        'rainfall':    float(rain_daily),
        'source':      'fallback',
    }
def get_weather(lat: float, lon: float, timeout: int = 6) -> dict:
    cached = _cached(lat, lon)
    if cached:
        cached['source'] = 'cache'
        return cached
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            f"&hourly=temperature_2m,relative_humidity_2m,precipitation"
            f"&daily=precipitation_sum"
            f"&timezone=auto"
            f"&forecast_days=1"
        )
        req = urllib.request.Request(url, headers={'User-Agent': 'CropRecommender/1.0'})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        # Use the local time strings returned by the API (timezone=auto)
        # instead of UTC hour, which would index the wrong hour for non-UTC zones.
        hourly_times = data.get('hourly', {}).get('time', [])
        hourly_temp  = data.get('hourly', {}).get('temperature_2m', [])
        hourly_hum   = data.get('hourly', {}).get('relative_humidity_2m', [])
        hourly_prec  = data.get('hourly', {}).get('precipitation', [])

        # Find the index whose local hour matches the current UTC hour offset
        # by comparing the date+hour in the time strings against utcnow.
        now_utc_str = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H')
        now_hour = 12  # safe default (midday)
        if hourly_times:
            # Open-Meteo returns "YYYY-MM-DDTHH:00" in local time.
            # We pick the entry closest to the current moment using a simple
            # index derived from position in the list (1 entry per hour).
            # Since forecast_days=1 gives 24 entries for today, we clamp
            # the UTC hour into [0, len-1] as a reasonable approximation,
            # but prefer matching on the local-time hour string if possible.
            local_hour_match = -1
            utc_hour = datetime.now(timezone.utc).hour
            for i, t in enumerate(hourly_times):
                # t looks like "2025-05-02T14:00"
                if len(t) >= 13:
                    entry_hour = int(t[11:13])
                    if entry_hour == utc_hour:
                        local_hour_match = i
                        break
            now_hour = local_hour_match if local_hour_match >= 0 else min(utc_hour, len(hourly_temp) - 1)
        temp = _safe_get(hourly_temp, now_hour, 25.0)
        hum  = _safe_get(hourly_hum,  now_hour, 70.0)
        daily_rain = data.get('daily', {}).get('precipitation_sum', [None])[0]
        if daily_rain is None:
            daily_rain = sum(v for v in hourly_prec[:24] if isinstance(v, (int, float)))
        temp      = max(-10, min(50, float(temp)))
        hum       = max(10,  min(100, float(hum)))
        daily_rain = max(0,  min(400, float(daily_rain)))
        result = {
            'temperature': round(temp, 1),
            'humidity':    round(hum, 1),
            'rainfall':    round(daily_rain, 1),
            'source':      'api',
        }
        _store_cache(lat, lon, result)
        return result
    except Exception as exc:
        print(f"[Weather] API failed ({exc}), using fallback.")
        return _fallback_weather()
def _safe_get(lst, idx, default):
    try:
        val = lst[idx]
        if val is None or (isinstance(val, float) and math.isnan(val)):
            return default
        return val
    except (IndexError, TypeError):
        return default