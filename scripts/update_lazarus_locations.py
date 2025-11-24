import csv
import json
import re
import sys
import unicodedata
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "public" / "data" / "pokemon_lazarus_pokemon_locations.csv"
JSON_PATH = ROOT / "public" / "data" / "pokemon_lazarus_reference.json"
CSV_ENCODING = "cp1252"


def read_csv_rows():
  with CSV_PATH.open("r", encoding=CSV_ENCODING, newline="") as handle:
    reader = csv.DictReader(handle)
    for row in reader:
      yield row


def normalize_text(value):
  if value is None:
    return ""
  if isinstance(value, (int, float)):
    value = str(value)
  return str(value).strip()


def normalize_name_key(value):
  text = normalize_text(value)
  if not text:
    return ""
  text = unicodedata.normalize("NFKD", text)
  text = "".join(ch for ch in text if not unicodedata.combining(ch))
  text = text.lower()
  text = re.sub(r"[^a-z0-9]+", "", text)
  return text


def main():
  if sys.stdout.encoding is not None and sys.stdout.encoding.lower() != "utf-8":
    try:
      sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
      pass

  if not CSV_PATH.exists():
    raise SystemExit(f"CSV file not found: {CSV_PATH}")
  if not JSON_PATH.exists():
    raise SystemExit(f"JSON file not found: {JSON_PATH}")

  data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
  records_by_name = {
    normalize_name_key(entry.get("name")): entry for entry in data if normalize_name_key(entry.get("name"))
  }

  # Reset existing location data
  for entry in data:
    entry["locationDetails"] = []
    entry["location"] = ""

  missing_names = OrderedDict()
  processed_rows = 0

  for row in read_csv_rows():
    name = normalize_text(row.get("Pokemon"))
    if not name or "?" in name:
      continue
    name_key = normalize_name_key(name)
    if not name_key:
      continue
    processed_rows += 1
    record = records_by_name.get(name_key)
    if not record:
      missing_names[name] = True
      continue

    detail = {
      "location": normalize_text(row.get("Location")),
      "method": normalize_text(row.get("Method")),
      "level": normalize_text(row.get("Level")),
      "moreInfo": normalize_text(row.get("More Info")),
      "extraInfo": normalize_text(row.get("More Info / Evo Method")),
    }

    record.setdefault("locationDetails", []).append(detail)

  for entry in data:
    details = entry.get("locationDetails") or []
    seen = set()
    ordered_locations = []
    for detail in details:
      location_name = normalize_text(detail.get("location"))
      if not location_name:
        continue
      key = location_name.lower()
      if key in seen:
        continue
      seen.add(key)
      ordered_locations.append(location_name)
    entry["location"] = ", ".join(ordered_locations)

  JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

  print(f"Processed {processed_rows} CSV rows.")
  if missing_names:
    print("Warning: Missing Pokemon entries for:", ", ".join(missing_names.keys()))


if __name__ == "__main__":
  main()

