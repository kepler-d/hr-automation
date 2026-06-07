import sys
import json
import requests
import re

def main():
    import os
    job_role = os.environ.get("JOB_ROLE")
    resume_text = os.environ.get("RESUME_TEXT")
    
    if not job_role or not resume_text:
        if len(sys.argv) >= 3:
            job_role = sys.argv[1]
            resume_text = sys.argv[2]
        else:
            try:
                stdin_data = sys.stdin.read().strip()
                if stdin_data:
                    input_json = json.loads(stdin_data)
                    job_role = input_json.get("job_role", "")
                    resume_text = input_json.get("resume_text", "")
                else:
                    raise ValueError("No stdin data, command arguments, or env variables provided")
            except Exception as e:
                print(json.dumps({
                    "score": 0,
                    "reason": f"Error: {str(e)}. Provide JOB_ROLE/RESUME_TEXT as env vars, cmd args, or stdin JSON.",
                    "skills_matched": [],
                    "missing_skills": []
                }))
                sys.exit(1)
    
    # Target prompt exactly as requested by the user
    prompt = f"""You are an expert HR recruiter. Evaluate this resume for the role of {job_role}.
Score the candidate from 0 to 100 based on:
- Skills match (40 points)
- Years of relevant experience (30 points)
- Education (20 points)
- Communication quality of resume (10 points)
Respond ONLY in JSON: {{ "score": score, "reason": "...", "skills_matched": [...], "missing_skills": [...] }}
Resume: {resume_text}"""

    # Inside docker compose, n8n connects to ollama at http://ollama:11434
    # For local CLI tests outside docker, we fallback to http://localhost:11434
    url = "http://ollama:11434/api/generate"
    try:
        # Check if running outside Docker (for local developer validation testing)
        requests.get("http://ollama:11434", timeout=1)
    except requests.exceptions.RequestException:
        url = "http://localhost:11434/api/generate"

    payload = {
        "model": "llama3",
        "prompt": prompt,
        "stream": False,
        "format": "json"  # Instruct Ollama to force JSON output
    }
    
    try:
        response = requests.post(url, json=payload, timeout=90)
        response.raise_for_status()
        result = response.json()
        response_text = result.get("response", "").strip()
        
        # Robustly parse JSON block in case Llama 3 includes any markdown wrappers
        match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if match:
            json_str = match.group(0)
            data = json.loads(json_str)
        else:
            data = json.loads(response_text)
            
        # Ensure it has all required fields
        required_keys = ["score", "reason", "skills_matched", "missing_skills"]
        for key in required_keys:
            if key not in data:
                if key == "score":
                    data[key] = 0
                elif key == "reason":
                    data[key] = "No evaluation details provided."
                else:
                    data[key] = []
                    
        # Force score to be an integer
        try:
            data["score"] = int(data["score"])
        except (ValueError, TypeError):
            data["score"] = 0
            
        print(json.dumps(data))
        
    except Exception as e:
        # Graceful fallback error reporting inside n8n workflow
        fallback = {
            "score": 0,
            "reason": f"AI Screener script error: {str(e)}",
            "skills_matched": [],
            "missing_skills": [],
            "error": str(e)
        }
        print(json.dumps(fallback))
        sys.exit(1)

if __name__ == "__main__":
    main()
