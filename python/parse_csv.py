import csv
import sys
import json
import os
from datetime import datetime

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: parse_csv.py <csv_file_path>"}))
        sys.exit(1)
        
    csv_file_path = sys.argv[1]
    if not os.path.exists(csv_file_path):
        print(json.dumps({"error": f"File not found at: {csv_file_path}"}))
        sys.exit(1)
        
    candidates = []
    try:
        with open(csv_file_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            # Map standard keys
            for row in reader:
                # Standardize keys by lowercasing and stripping spaces
                clean_row = {k.strip().lower(): (v.strip() if v else "") for k, v in row.items() if k}
                
                # Try finding matching headers
                name = clean_row.get("name") or clean_row.get("candidate name") or clean_row.get("full name") or ""
                email = clean_row.get("email") or clean_row.get("email address") or ""
                phone = clean_row.get("phone") or clean_row.get("phone number") or clean_row.get("contact") or ""
                resume_text = clean_row.get("resume") or clean_row.get("resume_text") or clean_row.get("resume text") or ""
                job_role = clean_row.get("job_role") or clean_row.get("role") or clean_row.get("job role") or ""
                timestamp = clean_row.get("timestamp") or clean_row.get("date") or datetime.now().isoformat()
                
                candidate = {
                    "name": name,
                    "email": email,
                    "phone": phone,
                    "resume_text": resume_text,
                    "job_role": job_role,
                    "timestamp": timestamp
                }
                candidates.append(candidate)
                
        print(json.dumps(candidates))
    except Exception as e:
        print(json.dumps({"error": f"Failed to parse CSV: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
