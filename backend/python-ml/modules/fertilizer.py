
import json
import os
import copy
_BASE = os.path.dirname(os.path.dirname(__file__))
_DATA_PATH = os.path.join(_BASE, 'data', 'fertilizerSchedule.json')
try:
    with open(_DATA_PATH, 'r') as f:
        _SCHEDULE_DB = json.load(f)
except FileNotFoundError:
    _SCHEDULE_DB = {}
_FERT_NUTRIENT = {
    'Urea': 'N',    
    'DAP':  'P',    
    'MOP':  'K',    
    'FYM':  None,   
}

_NUTRIENT_FERT = {'N': 'Urea', 'P': 'DAP', 'K': 'MOP'}
_DEFICIENCY_THRESHOLD = 0.75 
_EXCESS_THRESHOLD     = 1.30  

_DEFICIENCY_BOOST = 1.30  
_EXCESS_CUT       = 0.65  
def _classify_nutrient(actual, ideal):
    if ideal == 0:
        return 'adequate', 1.0
    ratio = actual / ideal
    if ratio < _DEFICIENCY_THRESHOLD:
        return 'deficient', ratio
    if ratio > _EXCESS_THRESHOLD:
        return 'excess', ratio
    return 'adequate', ratio


def _nutrient_status(crop_key, soil_npk):
    crop_data = _SCHEDULE_DB.get(crop_key, {})
    ideal = crop_data.get('npk_ha', {'N': 0, 'P2O5': 0, 'K2O': 0})

    ideal_mapped = {
        'N': ideal.get('N', 0),
        'P': ideal.get('P2O5', 0),
        'K': ideal.get('K2O', 0),
    }

    status = {}
    for nutrient in ('N', 'P', 'K'):
        actual = soil_npk.get(nutrient, 0)
        ideal_val = ideal_mapped[nutrient]
        classification, ratio = _classify_nutrient(actual, ideal_val)
        deficit_pct = round((1 - ratio) * 100, 1) if classification == 'deficient' else 0
        excess_pct  = round((ratio - 1) * 100, 1)  if classification == 'excess'    else 0
        status[nutrient] = {
            'actual':      actual,
            'ideal':       ideal_val,
            'status':      classification,
            'ratio':       round(ratio, 3),
            'deficit_pct': deficit_pct,
            'excess_pct':  excess_pct,
        }
    return status, ideal_mapped
def _multiplier_for(nutrient, status_map):
    s = status_map.get(nutrient, {}).get('status', 'adequate')
    if s == 'deficient':
        return _DEFICIENCY_BOOST
    if s == 'excess':
        return _EXCESS_CUT
    return 1.0


def _adjust_fertilizer(fert_name, base_qty, status_map):
    primary = _FERT_NUTRIENT.get(fert_name)
    if primary is None:
        return base_qty, 'Organic amendment — quantity unchanged'
    mult = _multiplier_for(primary, status_map)
    adjusted = round(base_qty * mult, 1)
    s = status_map.get(primary, {}).get('status', 'adequate')
    pct_change = round(abs(mult - 1) * 100)

    if s == 'deficient':
        reason = (
            f"{primary} deficiency detected (soil: {status_map[primary]['actual']} kg/ha, "
            f"ideal: {status_map[primary]['ideal']} kg/ha) — "
            f"{fert_name} increased by {pct_change}%"
        )
    elif s == 'excess':
        reason = (
            f"Excess {primary} in soil (soil: {status_map[primary]['actual']} kg/ha, "
            f"ideal: {status_map[primary]['ideal']} kg/ha) — "
            f"{fert_name} reduced by {pct_change}%"
        )
    else:
        reason = f"{primary} level is adequate — {fert_name} at standard rate"

    return adjusted, reason


def _build_plan(crop_key, soil_npk):
    crop_data = _SCHEDULE_DB.get(crop_key)

    if not crop_data:
        return None, f"No fertilizer data available for crop: {crop_key}"

    status_map, ideal_mapped = _nutrient_status(crop_key, soil_npk)
    base_schedule = copy.deepcopy(crop_data.get('schedule', []))

    plan = []
    for stage in base_schedule:
        adjusted_fertilizers = []
        stage_reasons = []

        for fert in stage.get('fertilizers', []):
            fname = fert.get('name', '')
            if 'qty_kg_ha' in fert:
                base_qty = fert['qty_kg_ha']
                unit = 'kg/ha'
            elif 'qty_t_ha' in fert:
                base_qty = fert['qty_t_ha']
                unit = 't/ha'
            else:
                base_qty = 0
                unit = 'kg/ha'
            adj_qty, reason = _adjust_fertilizer(fname, base_qty, status_map)
            adjusted_fertilizers.append({
                'name':          fname,
                'base_qty':      base_qty,
                'adjusted_qty':  adj_qty,
                'unit':          unit,
                'change':        round(adj_qty - base_qty, 1),
            })
            if reason not in stage_reasons:
                stage_reasons.append(reason)

        plan.append({
            'day':         stage.get('day', 0),
            'stage':       stage.get('stage', ''),
            'description': stage.get('description', ''),
            'fertilizers': adjusted_fertilizers,
            'reasons':     stage_reasons,
        })

    return plan, None


def _build_summary(crop_key, status_map):
    lines = []
    for nutrient, data in status_map.items():
        s = data['status']
        fert = _NUTRIENT_FERT.get(nutrient, '')
        if s == 'deficient':
            lines.append(
                f" {nutrient} is deficient ({data['deficit_pct']}% below ideal). "
                f"Recommended to increase {fert} application."
            )
        elif s == 'excess':
            lines.append(
                f" {nutrient} is in excess ({data['excess_pct']}% above ideal). "
                f"Reduce {fert} to avoid toxicity and waste."
            )
        else:
            lines.append(f" {nutrient} level is adequate. Standard {fert} rate applies.")

    note = _SCHEDULE_DB.get(crop_key, {}).get('note')
    if note:
        lines.append(f" Note: {note}")

    return lines
def get_fertilizer_recommendation(crop: str, soil_npk: dict) -> dict:
    crop_key = crop.strip().lower().replace(' ', '')
    plan, error = _build_plan(crop_key, soil_npk)
    if error or plan is None:
        return {
            'crop':            crop,
            'available':       False,
            'error':           error or 'No schedule found',
            'nutrient_status': {},
            'fertilizer_plan': [],
            'summary':         [],
        }
    status_map, _ = _nutrient_status(crop_key, soil_npk)
    crop_data      = _SCHEDULE_DB.get(crop_key, {})
    summary        = _build_summary(crop_key, status_map)

    return {
        'crop':               crop,
        'available':          True,
        'crop_duration_days': crop_data.get('duration_days', None),
        'fym_t_ha':           crop_data.get('fym_t_ha', None),
        'nutrient_status':    status_map,
        'fertilizer_plan':    plan,
        'summary':            summary,
    }
