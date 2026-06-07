import os
import sys
import json
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

def generate_report(candidates_file, output_pdf_path):
    # Load candidate records
    if candidates_file == "-":
        candidates = json.loads(sys.stdin.read())
    else:
        with open(candidates_file, 'r', encoding='utf-8') as f:
            candidates = json.load(f)
        
    total_applicants = len(candidates)
    
    # Process scores and outcomes
    scores = []
    shortlisted_count = 0
    top_candidates = []
    skills_freq = {}
    
    for c in candidates:
        # Score might be a string or integer
        try:
            score = int(c.get("Score") or c.get("score") or 0)
        except (ValueError, TypeError):
            score = 0
        
        scores.append(score)
        
        # Check shortlist status
        status = str(c.get("Status") or c.get("status") or "").lower()
        is_shortlisted = "shortlist" in status or score >= 65
        if is_shortlisted:
            shortlisted_count += 1
            
        name = c.get("Name") or c.get("name") or "Unknown"
        role = c.get("Job Role") or c.get("job_role") or "N/A"
        email = c.get("Email") or c.get("email") or "N/A"
        reason = c.get("Reason") or c.get("reason") or "No evaluation provided."
        
        top_candidates.append({
            "name": name,
            "role": role,
            "score": score,
            "email": email,
            "reason": reason
        })
        
        # Parse matched skills
        # Might be a JSON array or a comma-separated string
        skills = c.get("Skills Matched") or c.get("skills_matched") or []
        if isinstance(skills, str):
            # Check if it looks like a JSON array
            skills_str = skills.strip()
            if skills_str.startswith("[") and skills_str.endswith("]"):
                try:
                    skills = json.loads(skills_str)
                except Exception:
                    skills = [s.strip() for s in skills_str[1:-1].split(",") if s.strip()]
            else:
                skills = [s.strip() for s in skills_str.split(",") if s.strip()]
        
        if isinstance(skills, list):
            for skill in skills:
                skill_clean = str(skill).strip().title()
                if skill_clean:
                    skills_freq[skill_clean] = skills_freq.get(skill_clean, 0) + 1

    avg_score = sum(scores) / total_applicants if total_applicants > 0 else 0
    shortlisted_pct = (shortlisted_count / total_applicants * 100) if total_applicants > 0 else 0
    
    # Sort candidates by score descending for top candidates
    top_candidates.sort(key=lambda x: x["score"], reverse=True)
    top_5 = top_candidates[:5]
    
    # Sort skills by frequency
    sorted_skills = sorted(skills_freq.items(), key=lambda x: x[1], reverse=True)[:10]

    # Setup PDF Document with compact margins to optimize fit
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    # Define design colors (Slate blue theme)
    PRIMARY_COLOR = colors.HexColor("#1A365D")   # Deep navy
    SECONDARY_COLOR = colors.HexColor("#2B6CB0") # Medium blue
    TEXT_COLOR = colors.HexColor("#2D3748")      # Dark slate grey
    BG_LIGHT = colors.HexColor("#F7FAFC")        # Off-white
    BORDER_COLOR = colors.HexColor("#E2E8F0")    # Cool grey
    
    # Custom styles matching our design theme
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=PRIMARY_COLOR,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'ReportSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#718096"),
        spaceAfter=12
    )
    
    h1_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=SECONDARY_COLOR,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=TEXT_COLOR,
        leading=14
    )
    
    stat_val_style = ParagraphStyle(
        'StatVal',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=PRIMARY_COLOR,
        alignment=1 # Center
    )
    
    stat_label_style = ParagraphStyle(
        'StatLabel',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#4A5568"),
        alignment=1 # Center
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.white
    )

    table_body_style = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        textColor=TEXT_COLOR,
        leading=12
    )

    story = []
    
    # Header Title
    story.append(Paragraph("AI-Powered HR Automation Report", title_style))
    story.append(Paragraph(f"Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')} | Weekly Summary & Candidate Analysis", subtitle_style))
    story.append(Spacer(1, 10))
    
    # KPI Metrics Section
    stats_data = [
        [
            Paragraph(f"{total_applicants}", stat_val_style),
            Paragraph(f"{shortlisted_pct:.1f}%", stat_val_style),
            Paragraph(f"{avg_score:.1f}", stat_val_style)
        ],
        [
            Paragraph("Total Applicants", stat_label_style),
            Paragraph("Shortlist Rate", stat_label_style),
            Paragraph("Avg Screening Score", stat_label_style)
        ]
    ]
    
    stats_table = Table(stats_data, colWidths=[2.2*inch, 2.2*inch, 2.2*inch])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,0), 12),
        ('BOTTOMPADDING', (0,0), (-1,0), 2),
        ('TOPPADDING', (0,1), (-1,1), 2),
        ('BOTTOMPADDING', (0,1), (-1,1), 12),
        ('LINEBEFORE', (1,0), (1,-1), 0.5, BORDER_COLOR),
        ('LINEBEFORE', (2,0), (2,-1), 0.5, BORDER_COLOR),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E0")),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 10))
    
    # Top 5 Candidates Section
    story.append(Paragraph("Top 5 Evaluated Candidates", h1_style))
    
    cand_headers = [
        Paragraph("Name", table_header_style),
        Paragraph("Job Role", table_header_style),
        Paragraph("Score", table_header_style),
        Paragraph("Screening Reason Summary", table_header_style)
    ]
    
    cand_table_data = [cand_headers]
    for c in top_5:
        # Clean up reason text and truncate if necessary
        reason_text = c['reason'].replace('\n', ' ').strip()
        reason_truncated = reason_text[:115] + '...' if len(reason_text) > 115 else reason_text
        
        cand_table_data.append([
            Paragraph(c['name'], table_body_style),
            Paragraph(c['role'], table_body_style),
            Paragraph(f"<b>{c['score']}</b>", table_body_style),
            Paragraph(reason_truncated, table_body_style)
        ])
        
    cand_table = Table(cand_table_data, colWidths=[1.4*inch, 1.4*inch, 0.6*inch, 3.2*inch])
    cand_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
    ]))
    story.append(cand_table)
    story.append(Spacer(1, 10))
    
    # Skills Breakdown Section
    story.append(Paragraph("Commonly Identified Skills (Top 10)", h1_style))
    story.append(Paragraph("The breakdown below displays the most frequent skills extracted from the candidates' resumes:", body_style))
    story.append(Spacer(1, 4))
    
    skills_headers = [
        Paragraph("Skill Tag", table_header_style),
        Paragraph("Matched Count", table_header_style),
        Paragraph("Percentage of Candidates", table_header_style)
    ]
    skills_table_data = [skills_headers]
    for skill, count in sorted_skills:
        pct = (count / total_applicants * 100) if total_applicants > 0 else 0
        skills_table_data.append([
            Paragraph(skill, table_body_style),
            Paragraph(str(count), table_body_style),
            Paragraph(f"{pct:.1f}%", table_body_style)
        ])
        
    skills_table = Table(skills_table_data, colWidths=[3.2*inch, 1.5*inch, 1.9*inch])
    skills_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#4A5568")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
    ]))
    story.append(skills_table)
    
    # Build the document
    doc.build(story)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: generate_report.py <candidates_json_file> <output_pdf_path>"}))
        sys.exit(1)
    
    candidates_file = sys.argv[1]
    output_pdf_path = sys.argv[2]
    
    try:
        generate_report(candidates_file, output_pdf_path)
        print(json.dumps({"success": True, "output_pdf": os.path.abspath(output_pdf_path)}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
