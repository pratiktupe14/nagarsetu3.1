import os
import logging
from typing import Dict, Any, Optional

try:
    import googlemaps
except ImportError:
    import sys
    sys.path.append(os.path.dirname(__file__))
    import googlemaps

logger = logging.getLogger("google_maps_service")

# Nashik Service Area Boundary Configuration
NASHIK_BOUNDS = {
    "min_lat": 19.85,
    "max_lat": 20.15,
    "min_lng": 73.65,
    "max_lng": 73.95
}

def get_google_maps_client() -> Optional[googlemaps.Client]:
    """
    Initializes and returns the official Google Maps Python Client
    using GOOGLE_MAPS_API_KEY environment variable.
    """
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    if not api_key:
        logger.warning("GOOGLE_MAPS_API_KEY environment variable is missing.")
        return None
    try:
        return googlemaps.Client(key=api_key)
    except Exception as e:
        logger.error(f"Failed to initialize googlemaps client: {e}")
        return None

def is_within_nashik_bounds(lat: float, lng: float) -> bool:
    """
    Validates whether coordinates fall within Nashik Municipal Service Bounds.
    """
    if lat is None or lng is None:
        return False
    return (
        NASHIK_BOUNDS["min_lat"] <= lat <= NASHIK_BOUNDS["max_lat"] and
        NASHIK_BOUNDS["min_lng"] <= lng <= NASHIK_BOUNDS["max_lng"]
    )

def geocode_address(address: str) -> Dict[str, Any]:
    """
    Geocodes an address string using Google Maps Geocoding API.
    Biased to Nashik, Maharashtra, India.
    """
    if not address or len(address.strip()) < 2:
        return {"status": "INVALID_INPUT", "message": "Address is empty or too short."}

    client = get_google_maps_client()
    if not client:
        return {"status": "NO_API_KEY", "message": "Google Maps API Key not configured on server."}

    # Add Nashik bias if omitted
    search_query = address.strip()
    if "nashik" not in search_query.lower():
        search_query += ", Nashik, Maharashtra, India"

    try:
        results = client.geocode(search_query)
        if results and len(results) > 0:
            first = results[0]
            loc = first.get("geometry", {}).get("location", {})
            lat = loc.get("lat")
            lng = loc.get("lng")
            formatted_addr = first.get("formatted_address", address)
            place_id = first.get("place_id", "")

            valid_in_bounds = is_within_nashik_bounds(lat, lng)

            return {
                "status": "OK",
                "latitude": lat,
                "longitude": lng,
                "formatted_address": formatted_addr,
                "place_id": place_id,
                "is_within_service_area": valid_in_bounds
            }
        return {"status": "ZERO_RESULTS", "message": "No location results found for address."}
    except Exception as e:
        logger.error(f"Google Maps Geocode Error: {e}")
        return {"status": "ERROR", "message": str(e)}

def reverse_geocode(lat: float, lng: float) -> Dict[str, Any]:
    """
    Reverse-geocodes latitude and longitude into human-readable street address
    using Google Maps Reverse Geocoding API.
    """
    if lat is None or lng is None:
        return {"status": "INVALID_INPUT", "message": "Latitude or longitude missing."}

    client = get_google_maps_client()
    if not client:
        return {"status": "NO_API_KEY", "message": "Google Maps API Key not configured on server."}

    try:
        results = client.reverse_geocode((lat, lng))
        if results and len(results) > 0:
            first = results[0]
            formatted_addr = first.get("formatted_address", f"{lat}, {lng}")
            place_id = first.get("place_id", "")

            return {
                "status": "OK",
                "latitude": lat,
                "longitude": lng,
                "formatted_address": formatted_addr,
                "place_id": place_id,
                "is_within_service_area": is_within_nashik_bounds(lat, lng)
            }
        return {"status": "ZERO_RESULTS", "message": "No address found for specified coordinates."}
    except Exception as e:
        logger.error(f"Google Maps Reverse Geocode Error: {e}")
        return {"status": "ERROR", "message": str(e)}

def get_directions(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float, mode: str = "driving") -> Dict[str, Any]:
    """
    Calculates driving/transit directions between origin and destination coordinates
    using Google Maps Directions API.
    """
    if None in (origin_lat, origin_lng, dest_lat, dest_lng):
        return {"status": "INVALID_INPUT", "message": "Missing coordinate parameters."}

    client = get_google_maps_client()
    google_maps_nav_url = f"https://www.google.com/maps/dir/?api=1&origin={origin_lat},{origin_lng}&destination={dest_lat},{dest_lng}&travelmode={mode}"

    if not client:
        return {
            "status": "NO_API_KEY",
            "navigation_url": google_maps_nav_url,
            "message": "Google Maps API Key not configured on server. External directions URL provided."
        }

    try:
        origin_coords = (origin_lat, origin_lng)
        dest_coords = (dest_lat, dest_lng)
        routes = client.directions(origin_coords, dest_coords, mode=mode)

        if routes and len(routes) > 0:
            route = routes[0]
            leg = route["legs"][0]

            steps_summary = []
            for step in leg.get("steps", []):
                steps_summary.append({
                    "instruction": step.get("html_instructions", "").replace("<b>", "").replace("</b>", "").replace('<div style="font-size:0.9em">', " (").replace("</div>", ")"),
                    "distance": step.get("distance", {}).get("text", ""),
                    "duration": step.get("duration", {}).get("text", "")
                })

            return {
                "status": "OK",
                "distance_text": leg.get("distance", {}).get("text", ""),
                "distance_meters": leg.get("distance", {}).get("value", 0),
                "duration_text": leg.get("duration", {}).get("text", ""),
                "duration_seconds": leg.get("duration", {}).get("value", 0),
                "start_address": leg.get("start_address", ""),
                "end_address": leg.get("end_address", ""),
                "steps": steps_summary,
                "overview_polyline": route.get("overview_polyline", {}).get("points", ""),
                "navigation_url": google_maps_nav_url
            }
        return {
            "status": "ZERO_RESULTS",
            "navigation_url": google_maps_nav_url,
            "message": "No direct route found."
        }
    except Exception as e:
        logger.error(f"Google Maps Directions Error: {e}")
        return {
            "status": "ERROR",
            "navigation_url": google_maps_nav_url,
            "message": str(e)
        }
