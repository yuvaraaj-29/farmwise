"""
weather.py
----------
Fetches weather data from Open-Meteo (no API key required).
Features:
  • Correct unit: temperature in °C (API already returns Celsius).
  • In-memory cache keyed by (lat, lon, date) — avoids repeated calls.
  • Fallback values if API is unreachable.
  • Seasonal rainfall estimation as fallback.
"""

import urllib.request
import json
import time
import math
from datetime import datetime

# ── In-memory cache ────────────────────────────────────────────
_CACHE = {}
_CACHE_TTL_SECONDS = 3600  # 1 hour


def _cache_key(lat, lon):
    # Round to 2 decimal places to group nearby locations
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


# ── Fallback values (India climate averages, season-aware) ─────

_MONTHLY_INDIA = {
    # month: (avg_temp_C, avg_humidity_%, monthly_rainfall_mm)
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
    # Daily rainfall estimate from monthly average
    rain_daily = round(rain_monthly / 30, 1)
    return {
        'temperature': float(temp),
        'humidity':    float(hum),
        'rainfall':    float(rain_daily),
        'source':      'fallback',
    }


# ── Main fetch function ─────────────────────────────────────────

def get_weather(lat: float, lon: float, timeout: int = 6) -> dict:
    """
    Fetch current weather for (lat, lon).

    Returns dict:
        temperature : float  °C
        humidity    : float  %
        rainfall    : float  mm/day
        source      : 'api' | 'cache' | 'fallback'
    """
    # 1. Cache hit
    cached = _cached(lat, lon)
    if cached:
        cached['source'] = 'cache'
        return cached

    # 2. API call
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

        # Current hour (local time from API)
        now_hour = datetime.utcnow().hour  # approximate

        hourly_temp = data.get('hourly', {}).get('temperature_2m', [])
        hourly_hum  = data.get('hourly', {}).get('relative_humidity_2m', [])
        hourly_prec = data.get('hourly', {}).get('precipitation', [])

        # Temperature: API is already in °C (no Kelvin conversion needed)
        temp = _safe_get(hourly_temp, now_hour, 25.0)
        hum  = _safe_get(hourly_hum,  now_hour, 70.0)

        # Daily rainfall from dedicated 'daily' endpoint if available
        daily_rain = data.get('daily', {}).get('precipitation_sum', [None])[0]
        if daily_rain is None:
            # Sum first 24 hourly values as fallback
            daily_rain = sum(v for v in hourly_prec[:24] if isinstance(v, (int, float)))

        # Clamp to reasonable ranges
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
