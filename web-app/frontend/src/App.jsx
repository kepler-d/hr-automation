import React, { useState, useEffect } from 'react';

// Backend API URL configuration (relying on host routing or fallback)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobRole, setJobRole] = useState('Software Engineer');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  
  // Selected Candidate Drawer
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  
  // Fetch Candidates from API
  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/candidates`);
      if (!res.ok) throw new Error('Failed to fetch candidate logs.');
      const data = await res.json();
      setCandidates(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  // Handle File Upload & Screen
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Please select a resume file (PDF or TXT).');
      return;
    }
    
    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('email', email);
    formData.append('phone', phone);
    formData.append('job_role', jobRole);
    
    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to process resume.');
      }
      
      const result = await res.json();
      setUploadMessage(`Success! ${name} screened with a score of ${result.score}/100. Status: ${result.status}`);
      
      // Reset Form fields
      setName('');
      setEmail('');
      setPhone('');
      setFile(null);
      // Reset file input element
      document.getElementById('file-input').value = '';
      
      // Refresh list
      fetchCandidates();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Toggle Shortlist/Reject Status
  const handleStatusChange = async (candidateId, newStatus) => {
    try {
      const formData = new FormData();
      formData.append('status', newStatus);
      
      const res = await fetch(`${API_URL}/api/candidates/${candidateId}/status`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error('Failed to update status.');
      
      // Update local state
      setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, status: newStatus } : c));
      
      if (selectedCandidate && selectedCandidate.id === candidateId) {
        setSelectedCandidate(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Trigger Weekly Report PDF Download
  const handleDownloadReport = async () => {
    try {
      const res = await fetch(`${API_URL}/api/report`, { method: 'POST' });
      if (!res.ok) throw new Error('No candidate data available to compile report.');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'weekly_candidates_report.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(err.message);
    }
  };

  // Stats Calculations
  const totalCount = candidates.length;
  const shortlistCount = candidates.filter(c => c.status === 'Shortlisted').length;
  const shortlistPct = totalCount > 0 ? ((shortlistCount / totalCount) * 100).toFixed(1) : '0.0';
  const averageScore = totalCount > 0 
    ? (candidates.reduce((sum, c) => sum + c.score, 0) / totalCount).toFixed(1) 
    : '0.0';

  // Role list for filters
  const roles = ['All', ...new Set(candidates.map(c => c.job_role))];

  // Filtering candidates
  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || c.job_role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="app-container">
      {/* Sidebar Header */}
      <header className="app-header">
        <div className="header-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h1>HR AI Screener</h1>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleDownloadReport}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export PDF Report
          </button>
        </div>
      </header>

      {/* KPI Stats Ribbon */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon logo-blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Applicants</span>
            <span className="stat-val">{totalCount}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon logo-green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">Shortlist Rate</span>
            <span className="stat-val">{shortlistPct}%</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon logo-gold">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">Average AI Score</span>
            <span className="stat-val">{averageScore}</span>
          </div>
        </div>
      </section>

      {/* Main Grid: Upload Forms + Candidates List */}
      <main className="dashboard-main">
        
        {/* Upload Form Block */}
        <section className="form-section card">
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 12 15 15" />
            </svg>
            Screen New Candidate
          </h2>
          <form onSubmit={handleUploadSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input 
                type="text" 
                placeholder="e.g. Alice Smith" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>
            
            <div className="form-group-row">
              <div className="form-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  placeholder="e.g. alice@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Phone Number (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. +1234567890" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Job Role Target</label>
              <input 
                type="text" 
                placeholder="e.g. Software Engineer" 
                value={jobRole} 
                onChange={(e) => setJobRole(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label>Upload Resume File (PDF / TXT)</label>
              <div className="file-drop-zone">
                <input 
                  id="file-input"
                  type="file" 
                  accept=".pdf,.txt"
                  onChange={(e) => setFile(e.target.files[0])}
                  required
                />
                <div className="drop-zone-content">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>{file ? file.name : "Drag & drop file or click to browse"}</span>
                </div>
              </div>
            </div>

            {uploadMessage && <div className="alert success">{uploadMessage}</div>}
            {uploadError && <div className="alert danger">{uploadError}</div>}

            <button type="submit" className="btn-primary" disabled={uploading}>
              {uploading ? (
                <>
                  <span className="spinner"></span>
                  Processing with AI...
                </>
              ) : (
                "Upload and Run Screener"
              )}
            </button>
          </form>
        </section>

        {/* Datagrid Candidate Table */}
        <section className="table-section card">
          <div className="table-filters">
            <h2>Screened Candidates</h2>
            <div className="filter-controls">
              <input 
                type="text" 
                placeholder="Search candidates..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <select 
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)}
                className="filter-select"
              >
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <span className="spinner large"></span>
              <p>Loading candidate list...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p>{error}</p>
              <button className="btn-secondary" onClick={fetchCandidates}>Retry</button>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="empty-state">
              <p>No candidates match the selected filters.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="candidate-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Target Role</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map(c => {
                    const isPassed = c.score >= 65;
                    return (
                      <tr key={c.id} className="candidate-row" onClick={() => setSelectedCandidate(c)}>
                        <td>
                          <div className="candidate-info">
                            <strong>{c.name}</strong>
                            <span>{c.email}</span>
                          </div>
                        </td>
                        <td>{c.job_role}</td>
                        <td>
                          <span className={`score-badge ${isPassed ? 'pass' : 'fail'}`}>
                            {c.score}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <select 
                            value={c.status} 
                            onChange={(e) => handleStatusChange(c.id, e.target.value)}
                            className={`status-select ${c.status.toLowerCase()}`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Shortlisted">Shortlisted</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button className="btn-icon" onClick={() => setSelectedCandidate(c)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="12" cy="5" r="1" />
                              <circle cx="12" cy="19" r="1" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Candidate Details Modal/Drawer */}
      {selectedCandidate && (
        <div className="drawer-overlay" onClick={() => setSelectedCandidate(null)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Candidate Evaluation Profile</h3>
              <button className="btn-close" onClick={() => setSelectedCandidate(null)}>&times;</button>
            </div>
            
            <div className="drawer-body">
              <div className="profile-header">
                <h2>{selectedCandidate.name}</h2>
                <span className="profile-role">{selectedCandidate.job_role}</span>
                <div className="profile-meta">
                  <span><strong>Email:</strong> {selectedCandidate.email}</span>
                  {selectedCandidate.phone && <span><strong>Phone:</strong> {selectedCandidate.phone}</span>}
                  <span><strong>Screened:</strong> {new Date(selectedCandidate.timestamp).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="score-section">
                <div className="score-main">
                  <span className={`score-large ${selectedCandidate.score >= 65 ? 'pass' : 'fail'}`}>
                    {selectedCandidate.score}
                  </span>
                  <div>
                    <h4>Overall Screener Score</h4>
                    <span className={`status-pill ${selectedCandidate.status.toLowerCase()}`}>
                      {selectedCandidate.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h4>Evaluation Summary & Reason</h4>
                <p>{selectedCandidate.reason}</p>
              </div>

              <div className="skills-tags-container">
                <div className="skills-block">
                  <h4>Matched Skills</h4>
                  {selectedCandidate.skills_matched.length > 0 ? (
                    <div className="skills-grid">
                      {selectedCandidate.skills_matched.map(s => (
                        <span key={s} className="pill pill-green">{s}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="no-skills">No matched skills identified.</p>
                  )}
                </div>

                <div className="skills-block">
                  <h4>Missing Skills / Suggested Actions</h4>
                  {selectedCandidate.missing_skills.length > 0 ? (
                    <div className="skills-grid">
                      {selectedCandidate.missing_skills.map(s => (
                        <span key={s} className="pill pill-orange">{s}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="no-skills">No missing skills reported.</p>
                  )}
                </div>
              </div>

              {selectedCandidate.status === 'Shortlisted' && (selectedCandidate.meet_link || selectedCandidate.meeting_link) && (
                <div className="booking-section">
                  <h4>Interview Schedules</h4>
                  {selectedCandidate.meet_link && (
                    <p><strong>Google Meet:</strong> <a href={selectedCandidate.meet_link} target="_blank" rel="noreferrer">{selectedCandidate.meet_link}</a></p>
                  )}
                  {selectedCandidate.meeting_link && (
                    <p><strong>Calendar Event:</strong> <a href={selectedCandidate.meeting_link} target="_blank" rel="noreferrer">Open Invitation Event</a></p>
                  )}
                </div>
              )}

              <div className="resume-text-view">
                <h4>Extracted Resume Text</h4>
                <pre>{selectedCandidate.resume_text}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
