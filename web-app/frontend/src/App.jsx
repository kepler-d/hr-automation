import React, { useState, useEffect } from 'react';

// Backend API URL configuration (relying on host routing or fallback)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  // Navigation active tab: 'dashboard', 'applicants', 'jobs', 'scheduler', 'analytics', 'ats', 'settings'
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data State
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Settings (Stored in localStorage)
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('talentflow_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* use default */ }
    }
    return {
      threshold: 65,
      autoShortlist: true,
      ollamaModel: 'llama3',
      dbBackup: true
    };
  });

  useEffect(() => {
    localStorage.setItem('talentflow_settings', JSON.stringify(settings));
  }, [settings]);

  // Form State - Screen Candidate
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [file, setFile] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Form State - Create Job Opening
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescText, setJobDescText] = useState('');
  const [savingJob, setSavingJob] = useState(false);
  const [jobMessage, setJobMessage] = useState(null);
  const [jobError, setJobError] = useState(null);
  
  // Form State - Schedule Meeting
  const [schedulingCandidateId, setSchedulingCandidateId] = useState(null);
  const [meetLink, setMeetLink] = useState('');
  const [calendarLink, setCalendarLink] = useState('');
  const [scheduling, setScheduling] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Selected Candidate Drawer
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  // ATS Checker Page State
  const [atsJD, setAtsJD] = useState('');
  const [atsFile, setAtsFile] = useState(null);
  const [atsChecking, setAtsChecking] = useState(false);
  const [atsResult, setAtsResult] = useState(null);
  const [atsError, setAtsError] = useState(null);
  
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

  // Fetch Job Descriptions from API
  const fetchJobs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/jobs`);
      if (!res.ok) throw new Error('Failed to fetch job descriptions.');
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCandidates();
    fetchJobs();
  }, []);

  // Handle File Upload & Screen Candidate
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!jobRole.trim()) {
      setUploadError('Please specify a Job Role Target.');
      return;
    }
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
    formData.append('threshold', settings.threshold);
    if (selectedJobId) {
      formData.append('job_description_id', selectedJobId);
    }
    
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
      setSelectedJobId('');
      
      // Reset file input element
      const fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';
      
      // Refresh list
      fetchCandidates();
      
      // Close modal after 1.5s success message display
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadMessage(null);
      }, 1500);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Create Job Description handler
  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!jobTitle.trim() || !jobDescText.trim()) {
      setJobError('Please fill in both the Job Title and Job Description.');
      return;
    }
    setSavingJob(true);
    setJobError(null);
    setJobMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: jobTitle,
          description_text: jobDescText,
        }),
      });
      if (!res.ok) throw new Error('Failed to create job description.');
      const data = await res.json();
      setJobMessage(`Job "${data.title}" created successfully!`);
      setJobTitle('');
      setJobDescText('');
      fetchJobs();
      
      setTimeout(() => setJobMessage(null), 3000);
    } catch (err) {
      setJobError(err.message);
    } finally {
      setSavingJob(false);
    }
  };

  // Schedule Meeting handler
  const handleScheduleMeetingSubmit = async (e) => {
    e.preventDefault();
    if (!schedulingCandidateId) return;
    
    setScheduling(true);
    try {
      const formData = new FormData();
      formData.append('meet_link', meetLink);
      formData.append('meeting_link', calendarLink);

      const res = await fetch(`${API_URL}/api/candidates/${schedulingCandidateId}/meeting`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error('Failed to save interview schedules.');
      
      // Update local candidates state
      setCandidates(prev => prev.map(c => 
        c.id === schedulingCandidateId ? { ...c, meet_link: meetLink, meeting_link: calendarLink } : c
      ));
      
      if (selectedCandidate && selectedCandidate.id === schedulingCandidateId) {
        setSelectedCandidate(prev => ({ ...prev, meet_link: meetLink, meeting_link: calendarLink }));
      }
      
      setSchedulingCandidateId(null);
      setMeetLink('');
      setCalendarLink('');
      alert('Interview meeting links saved successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setScheduling(false);
    }
  };

  // ATS Checker Form handler
  const handleAtsCheckSubmit = async (e) => {
    e.preventDefault();
    if (!atsFile) {
      setAtsError('Please select your resume file (PDF or TXT).');
      return;
    }
    if (!atsJD.trim()) {
      setAtsError('Please paste the Job Description requirements.');
      return;
    }
    setAtsChecking(true);
    setAtsError(null);
    setAtsResult(null);

    const formData = new FormData();
    formData.append('file', atsFile);
    formData.append('job_description', atsJD);

    try {
      const res = await fetch(`${API_URL}/api/ats-check`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to analyze resume.');
      }

      const result = await res.json();
      setAtsResult(result);
    } catch (err) {
      setAtsError(err.message);
    } finally {
      setAtsChecking(false);
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

  // Global calculations for KPIs
  const totalCount = candidates.length;
  const shortlistCount = candidates.filter(c => c.status === 'Shortlisted').length;
  const shortlistPct = totalCount > 0 ? ((shortlistCount / totalCount) * 100).toFixed(1) : '0.0';
  const averageScore = totalCount > 0 
    ? (candidates.reduce((sum, c) => sum + c.score, 0) / totalCount).toFixed(1) 
    : '0.0';
  const activeJobsCount = jobs.length;

  // Filter candidates list
  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || c.job_role === roleFilter;
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const rolesList = ['All', ...new Set(candidates.map(c => c.job_role))];

  // Helper: Get Candidate counts by day of the week for chart
  const getWeeklyApplicationStats = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    
    candidates.forEach(c => {
      const date = new Date(c.timestamp);
      if (!isNaN(date.getTime())) {
        const dayIdx = date.getDay();
        counts[dayIdx] = counts[dayIdx] + 1;
      }
    });

    return days.map((day, idx) => ({
      day: day.substring(0, 3),
      count: counts[idx]
    }));
  };

  const chartData = getWeeklyApplicationStats();
  const maxDayCount = Math.max(...chartData.map(d => d.count), 1);

  // Leaderboard Top Candidates (Sort by score descending)
  const topCandidates = [...candidates]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="app-layout">
      {/* 1. Sidebar Component Layout */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <a href="#" className="sidebar-logo" onClick={() => setActiveTab('dashboard')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h1>TalentFlow AI</h1>
          </a>
          
          <nav className="sidebar-nav">
            <button 
              className={`sidebar-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" />
                <rect x="14" y="3" width="7" height="5" />
                <rect x="14" y="12" width="7" height="9" />
                <rect x="3" y="16" width="7" height="5" />
              </svg>
              Dashboard
            </button>
            <button 
              className={`sidebar-nav-btn ${activeTab === 'applicants' ? 'active' : ''}`}
              onClick={() => setActiveTab('applicants')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Applicants Pool
            </button>
            <button 
              className={`sidebar-nav-btn ${activeTab === 'jobs' ? 'active' : ''}`}
              onClick={() => setActiveTab('jobs')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              Job Openings
            </button>
            <button 
              className={`sidebar-nav-btn ${activeTab === 'scheduler' ? 'active' : ''}`}
              onClick={() => setActiveTab('scheduler')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Scheduler
            </button>
            <button 
              className={`sidebar-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Reports & Analytics
            </button>
            <button 
              className={`sidebar-nav-btn ${activeTab === 'ats' ? 'active' : ''}`}
              onClick={() => setActiveTab('ats')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              ATS Matcher
            </button>
            <button 
              className={`sidebar-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </button>
          </nav>
        </div>
        
        <div className="sidebar-footer">
          <div className="profile-avatar">HR</div>
          <div className="profile-info">
            <span className="profile-name">HR Administrator</span>
            <span className="profile-role-tag">Manager Panel</span>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="app-content">
        {/* Global Page Header */}
        <header className="app-header">
          <div className="header-title-section">
            <h2>
              {activeTab === 'dashboard' && 'Dashboard Overview'}
              {activeTab === 'applicants' && 'Applicant Management'}
              {activeTab === 'jobs' && 'Active Openings'}
              {activeTab === 'scheduler' && 'Interview Scheduler'}
              {activeTab === 'analytics' && 'Analytics Reports'}
              {activeTab === 'ats' && 'ATS Match Playground'}
              {activeTab === 'settings' && 'Global Configurations'}
            </h2>
            <p>
              {activeTab === 'dashboard' && 'Screening funnel and daily applications overview'}
              {activeTab === 'applicants' && 'Evaluate and manage submitted candidate resumes'}
              {activeTab === 'jobs' && 'Create and maintain target job requirements'}
              {activeTab === 'scheduler' && 'Establish meeting details for shortlisted profiles'}
              {activeTab === 'analytics' && 'Compile reports, scores, and exports'}
              {activeTab === 'ats' && 'Real-time keyword scoring and match diagnostics'}
              {activeTab === 'settings' && 'Configure threshold variables and screening modes'}
            </p>
          </div>
          
          <div className="header-actions">
            <button className="btn-secondary" onClick={handleDownloadReport}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Report
            </button>
            {activeTab === 'applicants' && (
              <button className="btn-primary" onClick={() => setShowUploadModal(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Screen Candidate
              </button>
            )}
          </div>
        </header>

        {/* ----------------- SUBPAGE: DASHBOARD OVERVIEW ----------------- */}
        {activeTab === 'dashboard' && (
          <>
            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon logo-blue">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </div>
                <div className="stat-content">
                  <span className="stat-label">Total Applicants</span>
                  <span className="stat-val">{totalCount}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon logo-green">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div className="stat-content">
                  <span className="stat-label">Average AI Score</span>
                  <span className="stat-val">{averageScore}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon logo-blue">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <div className="stat-content">
                  <span className="stat-label">Active Openings</span>
                  <span className="stat-val">{activeJobsCount}</span>
                </div>
              </div>
            </section>

            <section className="dashboard-grid">
              {/* Chart Grid: Trend & Funnel */}
              <div className="card">
                <h2>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  Weekly Applications Trend
                </h2>
                
                <div className="chart-container">
                  <div className="chart-bars">
                    {chartData.map(d => {
                      const percentage = maxDayCount > 0 ? (d.count / maxDayCount) * 100 : 0;
                      return (
                        <div key={d.day} className="chart-bar-wrapper">
                          <div 
                            className="chart-bar" 
                            style={{ height: `${Math.max(percentage, 3)}%` }}
                          >
                            <span className="chart-bar-tooltip">{d.count} Applied</span>
                          </div>
                          <span className="chart-bar-label">{d.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Leaderboard panel */}
              <div className="card">
                <h2>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Top Candidates Leaderboard
                </h2>
                <div className="leaderboard-list">
                  {topCandidates.length === 0 ? (
                    <p className="no-skills">No candidate evaluations available yet.</p>
                  ) : (
                    topCandidates.map(c => (
                      <div key={c.id} className="leaderboard-item" onClick={() => { setSelectedCandidate(c); }}>
                        <div className="leaderboard-info">
                          <span className="leaderboard-name">{c.name}</span>
                          <span className="leaderboard-role">{c.job_role}</span>
                        </div>
                        <span className="leaderboard-score">{c.score} pt</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="card">
              <h2>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                Candidate Pipeline Funnel
              </h2>
              <div className="funnel-container">
                <div className="funnel-row">
                  <span className="funnel-label">Applied</span>
                  <div className="funnel-bar-wrapper">
                    <div className="funnel-bar" style={{ width: '100%' }}>
                      <span className="funnel-value">{totalCount} (100%)</span>
                    </div>
                  </div>
                </div>
                
                <div className="funnel-row">
                  <span className="funnel-label">Screened</span>
                  <div className="funnel-bar-wrapper">
                    <div className="funnel-bar" style={{ width: totalCount > 0 ? '100%' : '0%' }}>
                      <span className="funnel-value">{totalCount} ({totalCount > 0 ? 100 : 0}%)</span>
                    </div>
                  </div>
                </div>

                <div className="funnel-row">
                  <span className="funnel-label">Shortlisted</span>
                  <div className="funnel-bar-wrapper">
                    <div className="funnel-bar" style={{ width: `${shortlistPct}%` }}>
                      <span className="funnel-value">{shortlistCount} ({shortlistPct}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ----------------- SUBPAGE: APPLICANTS POOL ----------------- */}
        {activeTab === 'applicants' && (
          <section className="table-section card">
            <div className="table-filters">
              <h2>Screened Candidates Pool ({filteredCandidates.length})</h2>
              <div className="filter-controls">
                <input 
                  type="text" 
                  placeholder="Search name/email..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                
                <select 
                  value={roleFilter} 
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="filter-select"
                >
                  {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Rejected">Rejected</option>
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
                <p>No candidates found matching the active criteria.</p>
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
                      <th>Screened Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCandidates.map(c => {
                      const isPassed = c.score >= settings.threshold;
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
                          <td>{new Date(c.timestamp).toLocaleDateString()}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button className="btn-icon" onClick={() => setSelectedCandidate(c)}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
        )}

        {/* ----------------- SUBPAGE: JOB OPENINGS ----------------- */}
        {activeTab === 'jobs' && (
          <section className="jobs-grid">
            {/* Create Job card */}
            <div className="card">
              <h2>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add New Job Opening
              </h2>
              <form onSubmit={handleCreateJob}>
                <div className="form-group">
                  <label>Job Posting Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Senior Backend Engineer" 
                    value={jobTitle} 
                    onChange={(e) => setJobTitle(e.target.value)} 
                    required 
                  />
                </div>
                
                <div className="form-group">
                  <label>Job Description Requirements</label>
                  <textarea 
                    placeholder="Provide details, key responsibilities, and required core skills..." 
                    value={jobDescText} 
                    onChange={(e) => setJobDescText(e.target.value)} 
                    required 
                    rows="6"
                    className="jd-textarea"
                  />
                </div>

                {jobMessage && <div className="alert success">{jobMessage}</div>}
                {jobError && <div className="alert danger">{jobError}</div>}

                <button type="submit" className="btn-primary" disabled={savingJob}>
                  {savingJob ? (
                    <>
                      <span className="spinner"></span>
                      Saving Job Opening...
                    </>
                  ) : (
                    "Publish Job Opening"
                  )}
                </button>
              </form>
            </div>

            {/* List Active Jobs */}
            <div className="card jobs-list-card">
              <h2>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                Active Job Openings ({activeJobsCount})
              </h2>
              
              {jobs.length === 0 ? (
                <p className="no-jds-text">No job openings created yet.</p>
              ) : (
                <div className="jd-list">
                  {jobs.map(j => {
                    const applicantsCount = candidates.filter(c => c.job_description_id === j.id).length;
                    return (
                      <div key={j.id} className="job-card">
                        <div className="job-card-header">
                          <h3>{j.title}</h3>
                          <span className="jd-id-tag">ID: {j.id}</span>
                        </div>
                        <div className="job-card-body">
                          <p className="jd-item-snippet">
                            {j.description_text.length > 180 
                              ? `${j.description_text.substring(0, 180)}...` 
                              : j.description_text}
                          </p>
                        </div>
                        <div className="job-card-footer">
                          <span className="job-stat-pill">{applicantsCount} Screened</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ----------------- SUBPAGE: INTERVIEW SCHEDULER ----------------- */}
        {activeTab === 'scheduler' && (
          <section className="scheduler-grid">
            <div className="card">
              <h2>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Pending Schedules (Shortlisted Candidates)
              </h2>
              
              <div className="leaderboard-list">
                {candidates.filter(c => c.status === 'Shortlisted').length === 0 ? (
                  <p className="no-skills">No shortlisted candidates pending schedule.</p>
                ) : (
                  candidates.filter(c => c.status === 'Shortlisted').map(c => (
                    <div key={c.id} className="schedule-card">
                      <div className="schedule-header">
                        <div className="schedule-candidate-info">
                          <h3>{c.name}</h3>
                          <span>{c.email}</span>
                        </div>
                        <span className="schedule-score-badge">Score: {c.score}</span>
                      </div>
                      
                      <div className="schedule-body">
                        <span className="schedule-field">
                          <strong>Target Role:</strong> {c.job_role}
                        </span>
                        {c.meet_link ? (
                          <span className="schedule-field text-green">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="23 7 16 12 23 17 23 7" />
                              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                            Google Meet Active: <a href={c.meet_link} target="_blank" rel="noreferrer">{c.meet_link.substring(0, 30)}...</a>
                          </span>
                        ) : (
                          <span className="schedule-field text-orange">No Meeting Set</span>
                        )}
                      </div>

                      <div className="schedule-actions">
                        <button 
                          className="btn-secondary" 
                          onClick={() => {
                            setSchedulingCandidateId(c.id);
                            setMeetLink(c.meet_link || '');
                            setCalendarLink(c.meeting_link || '');
                          }}
                        >
                          {c.meet_link ? 'Edit Schedule Links' : 'Assign Interview Links'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Schedule Booking Assign Modal Box */}
            {schedulingCandidateId && (
              <div className="card">
                <h2>Configure Schedule Links</h2>
                {(() => {
                  const cand = candidates.find(c => c.id === schedulingCandidateId);
                  return cand ? (
                    <form onSubmit={handleScheduleMeetingSubmit}>
                      <p className="settings-desc">Assign interview meeting URL and Google Calendar details for <strong>{cand.name}</strong>.</p>
                      
                      <div className="form-group">
                        <label>Google Meet URL</label>
                        <input 
                          type="url" 
                          placeholder="https://meet.google.com/abc-defg-hij" 
                          value={meetLink} 
                          onChange={(e) => setMeetLink(e.target.value)} 
                          required 
                        />
                      </div>

                      <div className="form-group">
                        <label>Google Calendar Link (Optional)</label>
                        <input 
                          type="url" 
                          placeholder="https://calendar.google.com/calendar/event..." 
                          value={calendarLink} 
                          onChange={(e) => setCalendarLink(e.target.value)} 
                        />
                      </div>

                      <div className="schedule-actions">
                        <button type="submit" className="btn-primary" disabled={scheduling}>
                          {scheduling ? 'Saving...' : 'Save Schedule'}
                        </button>
                        <button 
                          type="button" 
                          className="btn-secondary" 
                          onClick={() => {
                            setSchedulingCandidateId(null);
                            setMeetLink('');
                            setCalendarLink('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null;
                })()}
              </div>
            )}
          </section>
        )}

        {/* ----------------- SUBPAGE: REPORTS & ANALYTICS ----------------- */}
        {activeTab === 'analytics' && (
          <>
            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon logo-blue">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <div className="stat-content">
                  <span className="stat-label">Applicants Evaluated</span>
                  <span className="stat-val">{totalCount}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon logo-green">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="stat-content">
                  <span className="stat-label">Hiring Conversions</span>
                  <span className="stat-val">{shortlistCount}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon logo-gold">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div className="stat-content">
                  <span className="stat-label">Average Interview Score</span>
                  <span className="stat-val">{averageScore}</span>
                </div>
              </div>
            </section>

            <section className="dashboard-grid">
              <div className="card">
                <h2>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  Commonly Extracted Skills
                </h2>
                
                {/* Dynamically aggregate extracted skills */}
                {(() => {
                  const allSkills = [];
                  candidates.forEach(c => {
                    try {
                      const list = typeof c.skills_matched === 'string' ? JSON.parse(c.skills_matched) : c.skills_matched;
                      if (Array.isArray(list)) allSkills.push(...list);
                    } catch (e) {}
                  });
                  
                  const skillCounts = {};
                  allSkills.forEach(s => {
                    const clean = s.trim().toLowerCase();
                    skillCounts[clean] = (skillCounts[clean] || 0) + 1;
                  });
                  
                  const sorted = Object.entries(skillCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10);
                    
                  return sorted.length === 0 ? (
                    <p className="no-skills">No extracted skill tags available yet.</p>
                  ) : (
                    <div className="skills-grid">
                      {sorted.map(([skill, count]) => (
                        <span key={skill} className="pill pill-green" style={{ fontSize: '13px', padding: '8px 14px' }}>
                          {skill.charAt(0).toUpperCase() + skill.slice(1)} ({count})
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="card">
                <h2>PDF Generation Subprocess</h2>
                <p className="settings-desc">Run reportlab compilation inside the backend Docker stack to output candidates logs reports.</p>
                <button className="btn-primary" onClick={handleDownloadReport} style={{ width: 'max-content' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Generate PDF Summary Report
                </button>
              </div>
            </section>
          </>
        )}

        {/* ----------------- SUBPAGE: ATS MATCH PLAYGROUND ----------------- */}
        {activeTab === 'ats' && (
          <div className="dashboard-main ats-playground-main">
            {/* ATS Checker Form Card */}
            <section className="form-section card ats-form-card">
              <h2>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                ATS Match Playground
              </h2>
              <form onSubmit={handleAtsCheckSubmit}>
                <div className="form-group">
                  <label>Job Description Requirements</label>
                  <textarea 
                    placeholder="Paste the Job Description requirements here..." 
                    value={atsJD} 
                    onChange={(e) => setAtsJD(e.target.value)} 
                    required 
                    rows="6"
                    className="jd-textarea"
                  />
                </div>

                <div className="form-group">
                  <label>Upload Your Resume (PDF / TXT)</label>
                  <div className="file-drop-zone">
                    <input 
                      id="ats-file-input"
                      type="file" 
                      accept=".pdf,.txt"
                      onChange={(e) => setAtsFile(e.target.files[0])}
                      required
                    />
                    <div className="drop-zone-content">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>{atsFile ? atsFile.name : "Drag & drop file or click to browse"}</span>
                    </div>
                  </div>
                </div>

                {atsError && <div className="alert danger">{atsError}</div>}

                <button type="submit" className="btn-primary" disabled={atsChecking}>
                  {atsChecking ? (
                    <>
                      <span className="spinner"></span>
                      Analyzing ATS Match...
                    </>
                  ) : (
                    "Calculate ATS Match Score"
                  )}
                </button>
              </form>
            </section>

            {/* ATS Results Card */}
            <section className="table-section card ats-results-card">
              <h2>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                ATS Match Analysis
              </h2>

              {atsResult ? (
                <div className="ats-results-wrapper">
                  <div className="ats-score-badge-container">
                    <div className={`ats-score-ring ${atsResult.ats_score >= 80 ? 'good' : atsResult.ats_score >= 50 ? 'warning' : 'poor'}`}>
                      <span className="ats-score-num">{atsResult.ats_score}</span>
                      <span className="ats-score-label">Match Score</span>
                    </div>
                    <div className="ats-summary-container">
                      <h3>Analysis Summary</h3>
                      <p className="ats-summary-text">"{atsResult.match_summary}"</p>
                    </div>
                  </div>

                  <div className="ats-keywords-grid">
                    <div className="keywords-block">
                      <h4>Matched Keywords ({atsResult.matched_keywords.length})</h4>
                      {atsResult.matched_keywords.length > 0 ? (
                        <div className="keywords-tags">
                          {atsResult.matched_keywords.map((kw, i) => (
                            <span key={i} className="kw-tag kw-matched">{kw}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="no-keywords">No matched keywords found.</p>
                      )}
                    </div>

                    <div className="keywords-block">
                      <h4>Missing Keywords ({atsResult.missing_keywords.length})</h4>
                      {atsResult.missing_keywords.length > 0 ? (
                        <div className="keywords-tags">
                          {atsResult.missing_keywords.map((kw, i) => (
                            <span key={i} className="kw-tag kw-missing">{kw}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="no-keywords">No missing keywords identified.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ats-empty-state">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <p>Upload your resume and paste a job description on the left to calculate your real-time ATS match analysis.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ----------------- SUBPAGE: SETTINGS PAGE ----------------- */}
        {activeTab === 'settings' && (
          <section className="settings-grid">
            <div className="card settings-card">
              <h2>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                AI Model & Screening Parameters
              </h2>
              
              {/* Threshold variable slider */}
              <div className="settings-group">
                <div className="settings-label-wrapper">
                  <label>Auto-Shortlist Score Threshold</label>
                  <span className="settings-val-badge">{settings.threshold}/100</span>
                </div>
                <p className="settings-desc">Candidates scoring at or above this score are automatically designated as 'Shortlisted'. Others will be marked as 'Rejected'.</p>
                <div className="settings-slider-wrapper">
                  <span className="chart-bar-label">0</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={settings.threshold} 
                    onChange={(e) => setSettings(prev => ({ ...prev, threshold: parseInt(e.target.value, 10) }))}
                    className="settings-slider"
                  />
                  <span className="chart-bar-label">100</span>
                </div>
              </div>

              {/* Model selection dropdown */}
              <div className="settings-group">
                <div className="settings-label-wrapper">
                  <label>Ollama Screening Model</label>
                </div>
                <p className="settings-desc font-light">Select the local LLM model loaded inside the Ollama Docker container.</p>
                <select 
                  value={settings.ollamaModel}
                  onChange={(e) => setSettings(prev => ({ ...prev, ollamaModel: e.target.value }))}
                  className="filter-select"
                  style={{ width: '100%' }}
                >
                  <option value="llama3">Llama 3 (8B) -- Recomended</option>
                  <option value="mistral">Mistral (7B)</option>
                  <option value="phi3">Phi 3 (3.8B)</option>
                </select>
              </div>
            </div>

            <div className="card settings-card">
              <h2>Automated Workflows</h2>
              
              <div className="settings-toggle-wrapper">
                <div className="settings-toggle-label">
                  <span>Auto-Shortlist Candidate</span>
                  <p>Assign shortlisted status immediately based on score threshold</p>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={settings.autoShortlist} 
                    onChange={(e) => setSettings(prev => ({ ...prev, autoShortlist: e.target.checked }))}
                  />
                  <span className="slider-round"></span>
                </label>
              </div>

              <div className="settings-toggle-wrapper">
                <div className="settings-toggle-label">
                  <span>SQLite Fallback Mode</span>
                  <p>Enable automated SQLite database replication when PostgreSQL is down</p>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={settings.dbBackup} 
                    onChange={(e) => setSettings(prev => ({ ...prev, dbBackup: e.target.checked }))}
                  />
                  <span className="slider-round"></span>
                </label>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* 3. Screen New Candidate Modal (Popup overlay) */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Screen New Candidate Resume</h3>
              <button className="btn-close" onClick={() => setShowUploadModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
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
                  <label>Target Job Opening (Optional)</label>
                  <select
                    value={selectedJobId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedJobId(id);
                      if (id) {
                        const selected = jobs.find(j => j.id === parseInt(id));
                        if (selected) {
                          setJobRole(selected.title);
                        }
                      } else {
                        setJobRole('');
                      }
                    }}
                  >
                    <option value="">-- None (Generic Target Role) --</option>
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>{j.title}</option>
                    ))}
                  </select>
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
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                      Analyzing Candidate Resume...
                    </>
                  ) : (
                    "Upload and Run Screener"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 4. Candidate Details Modal/Drawer (Slide-in profile) */}
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

              {(() => {
                const linkedJob = jobs.find(j => j.id === selectedCandidate.job_description_id);
                return linkedJob ? (
                  <div className="details-section job-spec-section">
                    <h4>Target Job Description</h4>
                    <div className="job-spec-details">
                      <h5>{linkedJob.title}</h5>
                      <p className="job-spec-text" style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>
                        {linkedJob.description_text}
                      </p>
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="score-section">
                <div className="score-main">
                  <span className={`score-large ${selectedCandidate.score >= settings.threshold ? 'pass' : 'fail'}`}>
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
