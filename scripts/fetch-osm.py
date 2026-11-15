#!/usr/bin/env python3
"""Fetch central London OSM data and write a compact city.json (ODbL attribution required)."""
import json, math, sys, time, urllib.request, urllib.parse
from pathlib import Path

OUT = Path("/workspace/london-game/public/data/city.json")
SOUTH, WEST, NORTH, EAST = 51.501, -0.098, 51.518, -0.072
ORIGIN_LAT, ORIGIN_LON = 51.5074, -0.0877  # London Bridge
ENDPOINTS = [
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]
QUERY = f"""
[out:json][timeout:120][bbox:{SOUTH},{WEST},{NORTH},{EAST}];
(
  way["building"];
  relation["building"];
  way["highway"];
  way["area:highway"];
  way["natural"="water"];
  way["water"="river"];
  way["waterway"="riverbank"];
  relation["natural"="water"];
  relation["waterway"="riverbank"];
  relation["water"="river"];
  way["landuse"~"grass|forest|recreation_ground|meadow|village_green"];
  way["leisure"~"park|garden|pitch|playground"];
  way["amenity"="fountain"];
  node["railway"="station"];
  node["station"="subway"];
  node["public_transport"="station"];
  node["railway"="halt"];
  node["shop"];
  way["shop"];
  node["amenity"~"cafe|pub|restaurant|fast_food|bank|pharmacy|fuel"];
  way["amenity"~"cafe|pub|restaurant|fast_food|bank|pharmacy|fuel"];
  node["tourism"="attraction"];
  way["tourism"="attraction"];
  node["name"~"Shard|Gherkin|The Monument|Tower Bridge|London Bridge"];
);
out geom;
"""
UA = "LondonNights/1.0 (educational prototype; OSM ODbL; github.com/sohailhadimt)"

def lonlat_to_xz(lon, lat):
    x = (lon - ORIGIN_LON) * 111320.0 * math.cos(math.radians(ORIGIN_LAT))
    z = (ORIGIN_LAT - lat) * 110540.0  # +z is south
    return round(x, 2), round(z, 2)

def fetch():
    data = QUERY.strip().encode()
    last_err = None
    for url in ENDPOINTS:
        print(f"Fetching from {url} ...", flush=True)
        req = urllib.request.Request(
            url,
            data=urllib.parse.urlencode({"data": QUERY}).encode(),
            headers={"User-Agent": UA, "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                raw = r.read()
                print(f"  got {len(raw)} bytes, status ok", flush=True)
                return json.loads(raw)
        except Exception as e:
            last_err = e
            print(f"  failed: {type(e).__name__}: {e}", flush=True)
    raise SystemExit(f"All Overpass endpoints failed: {last_err}")

def poly_from_geom(geom):
    pts = []
    for g in geom or []:
        if "lon" in g and "lat" in g:
            pts.append(lonlat_to_xz(g["lon"], g["lat"]))
    # drop closing duplicate
    if len(pts) >= 2 and pts[0] == pts[-1]:
        pts = pts[:-1]
    return pts

def height_of(tags):
    # metres
    for key in ("height", "building:height"):
        v = tags.get(key)
        if v:
            try:
                return float(str(v).split()[0].replace("m", "").replace(",", ""))
            except ValueError:
                pass
    levels = tags.get("building:levels") or tags.get("levels")
    if levels:
        try:
            n = float(str(levels).split(";")[0])
            return max(4.0, n * 3.2)
        except ValueError:
            pass
    b = (tags.get("building") or "").lower()
    defaults = {
        "house": 8, "residential": 14, "apartments": 22, "commercial": 20,
        "retail": 10, "office": 36, "industrial": 12, "church": 18,
        "cathedral": 30, "train_station": 16, "hospital": 20, "school": 12,
        "warehouse": 10, "hotel": 28, "yes": 16, "terrace": 10, "detached": 8,
        "university": 18, "public": 16, "civic": 16, "skyscraper": 120,
    }
    return float(defaults.get(b, 16))

ROAD_WIDTH = {
    "motorway": 16, "trunk": 14, "primary": 12, "secondary": 11,
    "tertiary": 9, "unclassified": 7, "residential": 7, "living_street": 6,
    "service": 5, "motorway_link": 8, "trunk_link": 8, "primary_link": 8,
    "secondary_link": 7, "tertiary_link": 6, "pedestrian": 8, "footway": 3,
    "path": 2.5, "steps": 3, "cycleway": 2.5, "bridleway": 3,
}

def road_width(tags):
    if tags.get("area") == "yes":
        return None  # polygon area, handle separately if needed
    h = tags.get("highway")
    w = ROAD_WIDTH.get(h)
    if not w:
        return 6 if h else None
    lanes = tags.get("lanes")
    if lanes:
        try:
            n = float(str(lanes).split(";")[0])
            w = max(w, n * 3.4)
        except ValueError:
            pass
    return w

def main():
    osm = fetch()
    elements = osm.get("elements") or []
    print(f"Elements: {len(elements)}", flush=True)

    buildings, roads, water, parks, stations, shops, pois = [], [], [], [], [], [], []
    seen_station = set()

    for el in elements:
        tags = el.get("tags") or {}
        typ = el.get("type")
        geom = el.get("geometry") or el.get("members")

        # nodes
        if typ == "node":
            if "lon" not in el:
                continue
            x, z = lonlat_to_xz(el["lon"], el["lat"])
            name = tags.get("name") or tags.get("name:en") or ""
            if tags.get("railway") in ("station", "halt") or tags.get("station") == "subway" or (
                tags.get("public_transport") == "station" and tags.get("underground") == "yes"
            ) or "subway" in (tags.get("station", "") + tags.get("railway", "")):
                key = name or f"{round(x)}_{round(z)}"
                if key not in seen_station:
                    seen_station.add(key)
                    stations.append({"n": name or "Station", "x": x, "z": z, "tube": True})
            elif tags.get("shop") or tags.get("amenity") in (
                "cafe", "pub", "restaurant", "fast_food", "bank", "pharmacy", "fuel"
            ):
                shops.append({
                    "n": name or (tags.get("shop") or tags.get("amenity") or "Shop").title(),
                    "x": x, "z": z,
                    "k": tags.get("shop") or tags.get("amenity"),
                })
            elif name:
                pois.append({"n": name, "x": x, "z": z})
            continue

        # ways / relations with geom
        if typ == "way":
            pts = poly_from_geom(el.get("geometry"))
        elif typ == "relation":
            # collect outer members
            pts = []
            for mem in el.get("members") or []:
                if mem.get("role") in ("outer", "") and mem.get("geometry"):
                    chunk = poly_from_geom(mem.get("geometry"))
                    if len(chunk) > len(pts):
                        pts = chunk
        else:
            continue

        if len(pts) < 2:
            continue

        if "building" in tags:
            h = height_of(tags)
            # cap insane values; landmarks handled in-engine
            h = min(max(h, 4.0), 220.0)
            name = tags.get("name") or tags.get("addr:housename") or ""
            buildings.append({
                "p": pts,
                "h": round(h, 1),
                "n": name,
                "k": tags.get("building") if tags.get("building") != "yes" else (tags.get("building:use") or "yes"),
            })
        elif tags.get("natural") == "water" or tags.get("waterway") == "riverbank" or tags.get("water") == "river":
            if len(pts) >= 3:
                water.append({"p": pts})
        elif tags.get("landuse") in ("grass", "forest", "recreation_ground", "meadow", "village_green") or tags.get("leisure") in ("park", "garden", "pitch", "playground"):
            if len(pts) >= 3:
                parks.append({"p": pts})
        elif tags.get("highway"):
            w = road_width(tags)
            if w and len(pts) >= 2:
                roads.append({
                    "p": pts,
                    "w": round(w, 1),
                    "k": tags.get("highway"),
                    "name": tags.get("name") or "",
                    "oneway": tags.get("oneway") == "yes",
                    "bridge": tags.get("bridge") in ("yes", "viaduct"),
                    "tunnel": tags.get("tunnel") == "yes",
                })
        elif tags.get("shop") or tags.get("amenity") in (
            "cafe", "pub", "restaurant", "fast_food", "bank", "pharmacy"
        ):
            # use centroid
            cx = sum(p[0] for p in pts) / len(pts)
            cz = sum(p[1] for p in pts) / len(pts)
            name = tags.get("name") or (tags.get("shop") or tags.get("amenity") or "Shop").title()
            shops.append({"n": name, "x": round(cx, 2), "z": round(cz, 2), "k": tags.get("shop") or tags.get("amenity")})

    # Dedup shops that are very close
    dedup = []
    for s in shops:
        if any((s["x"]-t["x"])**2 + (s["z"]-t["z"])**2 < 40 for t in dedup):
            continue
        dedup.append(s)
    shops = dedup[:400]

    city = {
        "attribution": "© OpenStreetMap contributors, ODbL",
        "origin": {"lat": ORIGIN_LAT, "lon": ORIGIN_LON},
        "bbox": {"s": SOUTH, "w": WEST, "n": NORTH, "e": EAST},
        "buildings": buildings,
        "roads": roads,
        "water": water,
        "parks": parks,
        "stations": stations,
        "shops": shops,
        "pois": pois[:80],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(city, separators=(",", ":")))
    size = OUT.stat().st_size
    print(f"Wrote {OUT} ({size/1e6:.2f} MB)")
    print(f"  buildings={len(buildings)} roads={len(roads)} water={len(water)} parks={len(parks)} stations={len(stations)} shops={len(shops)} pois={len(pois)}")

if __name__ == "__main__":
    main()
