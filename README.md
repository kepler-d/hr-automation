# AI-Powered HR Automation System

An automated candidates intake, AI screening, emails notifier, interview scheduling, and metrics reporting platform. Runs entirely on your local machine for free.

## Folder Structure

```text
hr-automation/
├── docker-compose.yml
├── .env                  ← Local environment settings (never push to VCS)
├── .env.example          ← Template for environmental variables
├── n8n/
│   ├── Dockerfile        ← Custom Node-Alpine build adding Python 3 + Pip packages
│   └── workflows/
│       ├── intake_trigger.json
│       ├── ai_screener.json
│       ├── email_sender.json
│       ├── scheduler.json
│       └── weekly_report.json
├── python/
│   ├── send_to_ollama.py      ← Evaluates & scores resumes via local Ollama (Llama 3)
│   ├── parse_csv.py           ← Maps bulk uploads from CSV into clean JSON
│   └── generate_report.py     ← Builds a premium PDF stats report using ReportLab
├── web-app/
│   ├── backend/
│   │   ├── Dockerfile     ← FastAPI backend container build
│   │   ├── main.py        ← Python REST API endpoints
│   │   └── requirements.txt
│   └── frontend/
│       ├── Dockerfile     ← Multi-stage Nginx static web hosting
│       ├── src/
│       │   ├── App.jsx    ← React main Dashboard layout
│       │   └── index.css  ← Premium Vanilla CSS styles
│       └── package.json
└── README.md
```

---

## 1. Prerequisites & Host Dependencies

Ensure the following tools are installed on your host machine:
- **Docker** and **Docker Compose**
- **Git** (optional, to manage version control)
- **16GB+ RAM** (required for acceptable CPU-only performance of Llama 3) or a **GPU** with 8GB+ VRAM for accelerated inference.

---

## 2. Google Workspace APIs Setup

To integrate Gmail, Calendar, and Sheets, you must register a Google Cloud project:

1. **Create Google Cloud Project:**
   Go to the [Google Cloud Console](https://console.cloud.google.com/), create a new project.
2. **Enable APIs:**
   Navigate to the API Library and enable the following:
   - **Gmail API**
   - **Google Calendar API**
   - **Google Sheets API**
3. **Configure OAuth Consent Screen:**
   - Choose **External** user type.
   - Fill in the required application names and developer contact details.
   - Add scopes: `.../auth/gmail.send`, `.../auth/calendar`, and `.../auth/spreadsheets`.
   - Add your Gmail address as a **Test User** (since the app remains in "Testing" status).
4. **Create Credentials:**
   - Go to **Credentials** -> **Create Credentials** -> **OAuth Client ID**.
   - Application Type: **Web Application**.
   - Add Authorized Redirect URIs (needed for n8n authentication callback):
     `http://localhost:5678/rest/oauth2-credential/callback`
   - Copy the generated **Client ID** and **Client Secret** to configure them inside n8n's credential settings.

---

## 3. Google Sheets Setup

Create a new Google Sheet to log candidate details. Add the following header fields to the first row (Row 1):

| A | B | C | D | E | F | G | H | I | J | K | L | M |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Timestamp** | **Name** | **Email** | **Phone** | **Job Role** | **Resume Text** | **Score** | **Reason** | **Skills Matched** | **Missing Skills** | **Status** | **Meeting Link** | **Meet Link** |

Copy the **Spreadsheet ID** from the URL:
`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

You will enter this spreadsheet ID inside n8n's Google Sheets nodes.

---

## 4. Web Application Dashboard

An interactive, responsive HTML/JS control panel built using Vite + React (frontend) and FastAPI (backend) is integrated directly with the containers.

### UI Dashboard features:
- **Metrics Overview**: Shows candidate totals, shortlist conversion rates, and average screening scores.
- **Drag-and-Drop Uploader**: Screen individual resumes directly by dropping PDF or TXT files.
- **Interactive Candidates Table**: View, search, and filter evaluated candidates. Includes a status picker to manually override status.
- **Profile Detail Panel**: Click any candidate row to slide open a drawer detailing their contact info, AI matched skills (green pills), missing skills (orange pills), and full summary remarks.
- **Manual PDF compilation**: Download weekly ReportLab candidate metric PDFs instantly.

### Accessing Local Ports:
- **React Frontend Panel**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Backend (Swagger API Docs)**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 5. Bootstrapping the System

1. **Set Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill out your specific configurations (e.g. set `HR_MANAGER_EMAIL` to your target email).

2. **Launch Services:**
   Run the following command to build and launch all containers:
   ```bash
   docker-compose up -d --build
   ```
   *Note: On initial startup, the `ollama-pull-model` container will run in the background to automatically download the `llama3` model (4.7 GB). This may take several minutes depending on your internet connection. You can check the download status via:*
   ```bash
   docker logs -f hr-ollama-pull-model
   ```

3. **Verify Dashboard Access:**
   - Open **[http://localhost:3000](http://localhost:3000)** to view the HR Candidate Dashboard.
   - Open **[http://localhost:5678](http://localhost:5678)** to view the n8n Workflow dashboard.

---

## 6. Importing Workflows in n8n

*Note: All 5 workflows have **already been automatically pre-imported** into your local database using the n8n container CLI. They are ready to view in the n8n dashboard!*

If you need to manually import or restore workflows in the future:
1. In the n8n UI, click **Workflows** -> **Add Workflow** (or **New**).
2. Click the three dots menu (top-right corner) -> **Import from File**.
3. Select the corresponding JSON file under the `n8n/workflows/` directory.
4. Set up Google credentials:
   - For Gmail, Calendar, and Sheets nodes, click the credential drop-down and choose **Create New Credential**.
   - Input the **Client ID** and **Client Secret** generated in Step 2.
   - Click **Connect** and authorize using your Google test account.
5. In each node referencing a Google Sheet, paste your custom **Spreadsheet ID** and select your sheet tab name (e.g., `Sheet1`).
6. Save and **Activate** the workflow.

---

## 7. Local Developer Testing (No Google Setup Required)

You can run and verify the core Python engines locally on your machine without starting Docker or setting up Google APIs.

### Install Python Dependencies
```bash
pip install reportlab requests pandas
```

### Test AI resume scoring locally
Ensure Ollama is running locally on your machine (`ollama run llama3`), then run:
```bash
python python/send_to_ollama.py "Software Engineer" "John Doe. 5 years Python, Django development. B.S. in CS."
```
It should return a JSON response similar to:
```json
{"score": 75, "reason": "...", "skills_matched": ["Python", "Django"], "missing_skills": []}
```

### Test CSV parser locally
Create a sample candidate CSV file (e.g. `candidates.csv`) and run:
```bash
python python/parse_csv.py candidates.csv
```
This returns a standard candidates JSON array.

### Test PDF Report generator locally
Generate a mock candidates list JSON file (e.g., `mock_candidates.json`):
```json
[
  {
    "Name": "Alice Smith",
    "Email": "alice@example.com",
    "Job Role": "Data Scientist",
    "Score": 85,
    "Status": "Shortlisted",
    "Reason": "Excellent statistics knowledge and Pandas experience.",
    "Skills Matched": "[\"Python\", \"Pandas\", \"Machine Learning\"]"
  },
  {
    "Name": "Bob Jones",
    "Email": "bob@example.com",
    "Job Role": "Data Scientist",
    "Score": 50,
    "Status": "Rejected",
    "Reason": "Lacks direct Python experience.",
    "Skills Matched": "[\"SQL\"]"
  }
]
```
Run the generator:
```bash
python python/generate_report.py mock_candidates.json report.pdf
```
Open the generated `report.pdf` to inspect the statistics dashboard layout and design.
