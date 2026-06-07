import os
import sys
import json
import re
import tempfile
from datetime import datetime
from typing import List, Optional
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pypdf import PdfReader
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# Setup environment variables fallbacks
DATABASE_URL = os.environ.get(
    "DATABASE_URL", 
    "postgresql://n8n:n8n_secure_db_pass_123@postgres:5432/n8n"
)
OLLAMA_API_URL = os.environ.get("OLLAMA_API_URL", "http://ollama:11434")

# Database Setup with SQLite fallback for local host execution
try:
    if "postgresql" in DATABASE_URL:
        # Create engine and test connection with a short timeout
        engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 3})
        with engine.connect() as conn:
            pass
    else:
        engine = create_engine(DATABASE_URL)
except Exception:
    # Fallback to local SQLite database in temp directory if PostgreSQL is not reachable
    db_path = os.path.join(tempfile.gettempdir(), "hr_automation.db")
    DATABASE_URL = f"sqlite:///{db_path}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Candidate(Base):
    __tablename__ = "dashboard_candidates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, index=True)
    phone = Column(String, nullable=True)
    job_role = Column(String, index=True)
    resume_text = Column(Text)
    score = Column(Integer)
    reason = Column(Text)
    skills_matched = Column(Text)  # Saved as JSON string
    missing_skills = Column(Text)  # Saved as JSON string
    status = Column(String, default="Pending") # Pending, Shortlisted, Rejected
    meeting_link = Column(String, nullable=True)
    meet_link = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# FastAPI Init
app = FastAPI(title="HR Automation API", version="1.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper: Parse text from uploaded resume file
def extract_text_from_file(file: UploadFile) -> str:
    import io
    filename = file.filename.lower()
    file.file.seek(0)
    content = file.file.read()
    
    if filename.endswith(".txt"):
        return content.decode("utf-8", errors="ignore")
        
    elif filename.endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(content))
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return text
        except Exception as e:
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to parse PDF resume: {str(e)}"
            )
            
    else:
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file format. Please upload a PDF or TXT file."
        )

# Helper: Screen resume using Llama 3 on Ollama
def query_ollama_screener(job_role: str, resume_text: str) -> dict:
    prompt = f"""You are an expert HR recruiter. Evaluate this resume for the role of {job_role}.
Score the candidate from 0 to 100 based on:
- Skills match (40 points)
- Years of relevant experience (30 points)
- Education (20 points)
- Communication quality of resume (10 points)
Respond ONLY in JSON: {{ "score": score, "reason": "...", "skills_matched": [...], "missing_skills": [...] }}
Resume: {resume_text}"""

    url = f"{OLLAMA_API_URL}/api/generate"
    payload = {
        "model": "llama3",
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=90)
        response.raise_for_status()
        result = response.json()
        
        if "error" in result:
            return {
                "score": 0,
                "reason": f"Ollama model error: {result['error']}",
                "skills_matched": [],
                "missing_skills": []
            }
            
        response_text = result.get("response", "").strip()
        if not response_text:
            return {
                "score": 0,
                "reason": "Ollama returned an empty response.",
                "skills_matched": [],
                "missing_skills": []
            }
            
        match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        return json.loads(response_text)
    except Exception as e:
        return {
            "score": 0,
            "reason": f"AI screener connection error: {str(e)}",
            "skills_matched": [],
            "missing_skills": []
        }

@app.get("/api/candidates")
def list_candidates(db: Session = Depends(get_db)):
    candidates = db.query(Candidate).order_by(Candidate.timestamp.desc()).all()
    result = []
    for c in candidates:
        try:
            skills_matched = json.loads(c.skills_matched) if c.skills_matched else []
        except Exception:
            skills_matched = []
            
        try:
            missing_skills = json.loads(c.missing_skills) if c.missing_skills else []
        except Exception:
            missing_skills = []
            
        result.append({
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "job_role": c.job_role,
            "resume_text": c.resume_text,
            "score": c.score,
            "reason": c.reason,
            "skills_matched": skills_matched,
            "missing_skills": missing_skills,
            "status": c.status,
            "meeting_link": c.meeting_link,
            "meet_link": c.meet_link,
            "timestamp": c.timestamp.isoformat() if c.timestamp else datetime.utcnow().isoformat()
        })
    return result

@app.post("/api/upload")
def upload_candidate(
    file: UploadFile = File(...),
    job_role: str = Form(...),
    name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    # 1. Parse text from file
    resume_text = extract_text_from_file(file)
    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file.")
        
    # 2. Run AI Screener
    ai_result = query_ollama_screener(job_role, resume_text)
    
    # Safely convert score to integer
    try:
        score = int(ai_result.get("score", 0))
    except (ValueError, TypeError):
        score = 0
        
    status = "Shortlisted" if score >= 65 else "Rejected"
    
    # Safely parse skills_matched & missing_skills
    skills_matched = ai_result.get("skills_matched", [])
    if isinstance(skills_matched, str):
        skills_matched = [s.strip() for s in skills_matched.split(",") if s.strip()]
    elif not isinstance(skills_matched, list):
        skills_matched = []
        
    missing_skills = ai_result.get("missing_skills", [])
    if isinstance(missing_skills, str):
        missing_skills = [s.strip() for s in missing_skills.split(",") if s.strip()]
    elif not isinstance(missing_skills, list):
        missing_skills = []
        
    # 3. Save Candidate record
    candidate = Candidate(
        name=name,
        email=email,
        phone=phone,
        job_role=job_role,
        resume_text=resume_text,
        score=score,
        reason=ai_result.get("reason", ""),
        skills_matched=json.dumps(skills_matched),
        missing_skills=json.dumps(missing_skills),
        status=status
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    
    return {
        "id": candidate.id,
        "name": candidate.name,
        "email": candidate.email,
        "score": candidate.score,
        "status": candidate.status,
        "reason": candidate.reason
    }

@app.post("/api/candidates/{id}/status")
def update_candidate_status(
    id: int, 
    status: str = Form(...), 
    db: Session = Depends(get_db)
):
    candidate = db.query(Candidate).filter(Candidate.id == id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    if status not in ["Pending", "Shortlisted", "Rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status option")
        
    candidate.status = status
    db.commit()
    return {"id": candidate.id, "status": candidate.status}

@app.post("/api/report")
def export_report(db: Session = Depends(get_db)):
    candidates = db.query(Candidate).all()
    if not candidates:
        raise HTTPException(status_code=404, detail="No candidates found to generate report")
        
    # Format candidates list
    cand_list = []
    for c in candidates:
        try:
            skills_matched = json.loads(c.skills_matched) if c.skills_matched else []
        except Exception:
            skills_matched = []
            
        cand_list.append({
            "name": c.name,
            "email": c.email,
            "job_role": c.job_role,
            "score": c.score,
            "status": c.status,
            "reason": c.reason,
            "skills_matched": skills_matched
        })
        
    # Write to temp JSON using unique name to avoid concurrent file conflicts
    import uuid
    temp_json_filename = f"candidates_report_{uuid.uuid4().hex}.json"
    temp_json_path = os.path.join(tempfile.gettempdir(), temp_json_filename)
    with open(temp_json_path, "w") as f:
        json.dump(cand_list, f)
        
    # Resolve generate_report.py path dynamically
    python_script = "/data/python/generate_report.py"
    if not os.path.exists(python_script):
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        python_script = os.path.abspath(os.path.join(backend_dir, "..", "..", "python", "generate_report.py"))
        
    temp_pdf_filename = f"weekly_report_dashboard_{uuid.uuid4().hex}.pdf"
    output_pdf = os.path.join(tempfile.gettempdir(), temp_pdf_filename)
    
    import subprocess
    try:
        # Run report generator as a subprocess
        result = subprocess.run(
            [sys.executable, python_script, temp_json_path, output_pdf],
            capture_output=True,
            text=True,
            check=True
        )
        
        return FileResponse(
            output_pdf, 
            media_type="application/pdf", 
            filename="weekly_candidates_report.pdf"
        )
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr or e.stdout or str(e)
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {error_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run report generator: {str(e)}")
    finally:
        if os.path.exists(temp_json_path):
            try:
                os.remove(temp_json_path)
            except Exception:
                pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
