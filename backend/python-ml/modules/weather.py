import urllib.request
import json
import time
import math
from datetime import datetime, timezone

_CACHE = {}
_CACHE_TTL_SECONDS = 1800  # 30 minutes


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _cache_key(lat, lon):
    slot = datetime.now(timezone.utc).strftime('%Y-%m-%d-%H')
    return f"{round(lat, 2)},{round(lon, 2)},{slot}"


def _cached(lat, lon):
    entry = _CACHE.get(_cache_key(lat, lon))
    if entry and (time.time() - entry['ts'] < _CACHE_TTL_SECONDS):
        return {**entry['data'], 'source': 'cache'}
    return None


def _store_cache(lat, lon, data):
    _CACHE[_cache_key(lat, lon)] = {'data': data, 'ts': time.time()}


# ── Seasonal fallback (India averages) ───────────────────────────────────────

_MONTHLY_INDIA = {
    1:  (18, 55,  10),  2:  (21, 50,  15),  3:  (26, 48,  12),
    4:  (31, 45,  20),  5:  (34, 48,  35),  6:  (33, 75, 165),
    7:  (30, 85, 300),  8:  (29, 85, 280),  9:  (29, 80, 195),
    10: (27, 72,  70),  11: (23, 62,  30),  12: (19, 58,  15),
}


def _fallback_weather():
    month = datetime.now(timezone.utc).month
    temp, hum, rain_monthly = _MONTHLY_INDIA[month]
    return {
        'temperature': float(temp),
        'humidity':    float(hum),
        'rainfall':    round(rain_monthly / 30, 1),
        'source':      'fallback',
    }


# ── Main entry point ──────────────────────────────────────────────────────────

def get_weather(lat: float, lon: float, timeout: int = 8) -> dict:
    """
    Return {temperature, humidity, rainfall, source} for the coordinates.

    Uses Open-Meteo's `current` endpoint — gives the actual current observation
    at the exact lat/lon with no hourly-index arithmetic or timezone confusion.
    Falls back to seasonal India averages on any error.
    """
    cached = _cached(lat, lon)
    if cached:
        return cached

    try:
        # &current=  →  point-in-time values, no hour-index needed
        # &daily=precipitation_sum  →  today's total rainfall for ML
        # &timezone=auto  →  local times in response (we only use current values)
        url = (
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            "&current=temperature_2m,relative_humidity_2m,precipitation"
            "&daily=precipitation_sum"
            "&timezone=auto"
            "&forecast_days=1"
        )
        req = urllib.request.Request(
            url, headers={'User-Agent': 'FarmWise/2.0 (crop-recommender)'}
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        current = data.get('current', {})
        temp      = current.get('temperature_2m')
        hum       = current.get('relative_humidity_2m')
        precip_hr = current.get('precipitation', 0.0)  # mm in last hour

        # Prefer daily total for rainfall (more meaningful for ML model)
        daily    = data.get('daily', {})
        rain_sum = daily.get('precipitation_sum', [None])[0]
        rainfall = rain_sum if rain_sum is not None else (precip_hr * 24)

        if temp is None or hum is None:
            raise ValueError("Missing fields in Open-Meteo response")

        temp     = max(-10, min(50,  float(temp)))
        hum      = max(10,  min(100, float(hum)))
        rainfall = max(0,   min(400, float(rainfall)))

        result = {
            'temperature': round(temp, 1),
            'humidity':    round(hum, 1),
            'rainfall':    round(rainfall, 1),
            'source':      'api',
        }
        _store_cache(lat, lon, result)
        return result

    except Exception as exc:
        print(f"[Weather] Open-Meteo failed ({lat},{lon}): {exc} — using fallback")
        return _fallback_weather()


def _safe_get(lst, idx, default):
    """Kept for backward compatibility — no longer used internally."""
    try:
        val = lst[idx]
        if val is None or (isinstance(val, float) and math.isnan(val)):
            return default
        return val
    except (IndexError, TypeError):
        return default