// --- Global State ---
let courses = [];
let currentUser = null;

// --- DOM Elements ---
const catalogView = document.getElementById('catalog-view');
const detailView = document.getElementById('detail-view');
const studentView = document.getElementById('student-view'); // NEW
const adminView = document.getElementById('admin-view'); // NEW
const courseGrid = document.getElementById('course-grid');
const courseContent = document.getElementById('course-content');
const authModal = document.getElementById('auth-modal');

async function init() {
    checkSavedSession();
    await fetchCourses();
    renderCourses();

    // 1. Initial Pop-up: Show login page when a user first visits
    if (!currentUser && !sessionStorage.getItem('initial_popup_shown')) {
        sessionStorage.setItem('initial_popup_shown', 'true');
        setTimeout(() => {
            authModal.classList.remove('hidden');
            showToast("Welcome! Create an account to enroll in courses.", "success");
        }, 800);
    }
}

async function checkSavedSession() {
    // 1. Check if Supabase redirected back with an access token in the URL hash
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1)); // Remove the '#'
        const accessToken = params.get('access_token');
        
        if (accessToken) {
            try {
                const res = await fetch('/api/verify-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: accessToken })
                });
                const data = await res.json();
                
                if (res.ok) {
                    currentUser = { token: data.access_token, name: data.name };
                    localStorage.setItem('access_token', data.access_token);
                    localStorage.setItem('user_name', data.name);
                    updateUIForUser();
                    
                    // Clean up the ugly hash tokens from the URL bar
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    showToast(`Email verified successfully! Welcome, ${data.name}.`, "success");
                    return;
                }
            } catch (err) {
                console.error("URL token verification failed:", err);
            }
        }
    }

    // 2. Standard LocalStorage check if no URL token is present
    const token = localStorage.getItem('access_token');
    const name = localStorage.getItem('user_name');
    if (token && name) {
        currentUser = { token, name };
        updateUIForUser();
    }
}

function updateUIForUser() {
    const userDisplay = document.getElementById('user-display');
    const authBtn = document.getElementById('auth-btn');
    
    // NEW: Navigation Elements
    const mainNav = document.getElementById('main-nav');
    const navStudent = document.getElementById('nav-student');
    const navAdmin = document.getElementById('nav-admin');

    if (currentUser) {
        userDisplay.innerHTML = `<span style="color: var(--accent-cyan); font-family: var(--font-mono);">STUDENT: ${currentUser.name}</span>`;
        authBtn.textContent = 'LOGOUT';
        authBtn.onclick = handleLogout;
        
        // Show Navigation Links
        mainNav.classList.remove('hidden');
        navStudent.classList.remove('hidden');
        
        // Admin Gimmick: Show Admin tab if name contains "Admin"
        if (currentUser.name.toLowerCase().includes('admin')) {
            navAdmin.classList.remove('hidden');
        } else {
            navAdmin.classList.add('hidden');
        }
    } else {
        userDisplay.textContent = 'Not Logged In';
        authBtn.textContent = 'LOGIN / SIGNUP';
        authBtn.onclick = toggleAuthModal;
        
        // Hide Navigation Links
        mainNav.classList.add('hidden');
        navStudent.classList.add('hidden');
        navAdmin.classList.add('hidden');
        switchTab('catalog-view'); // Force back to public view on logout
    }
}

// --- NEW: View Switching Logic ---
function switchTab(viewId) {
    // Hide all primary views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    // Reset all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    // Activate selected view
    document.getElementById(viewId).classList.remove('hidden');
    document.getElementById(viewId).classList.add('active');
    
    // Highlight the active nav button and trigger data fetches
    if (viewId === 'catalog-view') {
        document.getElementById('nav-catalog').classList.add('active');
    } else if (viewId === 'student-view') {
        document.getElementById('nav-student').classList.add('active');
        fetchStudentDashboard();
    } else if (viewId === 'admin-view') {
        document.getElementById('nav-admin').classList.add('active');
        fetchAdminDashboard();
    }
}

function showCatalog() {
    // Replaced standard hide/show with the new robust tab switcher
    switchTab('catalog-view');
}

// --- Auth Modals & Helpers ---
function toggleAuthModal() {
    authModal.classList.toggle('hidden');
}

function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    const slider = document.getElementById('tab-slider');
    
    if (isLogin) {
        slider.classList.remove('slide-right');
    } else {
        slider.classList.add('slide-right');
    }

    document.getElementById('tab-login').classList.toggle('active', isLogin);
    document.getElementById('tab-signup').classList.toggle('active', !isLogin);
    document.getElementById('login-form').classList.toggle('hidden', !isLogin);
    document.getElementById('signup-form').classList.toggle('hidden', isLogin);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = type === 'success' ? `✓ ${message}` : `⚠ ${message}`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}

function formatBackendError(detail) {
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        return detail.map(err => {
            const field = err.loc[err.loc.length - 1]; 
            return `${field}: ${err.msg}`;
        }).join(' | ');
    }
    return "An unknown error occurred.";
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return; 
    
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈'; 
    } else {
        input.type = 'password';
        btn.textContent = '👁️'; 
    }
}

// --- NEW: OAuth Logic ---
function handleOAuth(provider) {
    // NOTE: Replace YOUR_PROJECT_ID before pushing to production
    const supabaseUrl = 'https://YOUR_PROJECT_ID.supabase.co'; 
    const redirectUri = window.location.origin; 
    
    window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${redirectUri}`;
}

// --- Auth Endpoints ---
async function handleSignup(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('signup-name').value.trim(),
        age: parseInt(document.getElementById('signup-age').value),
        qualification: document.getElementById('signup-qualification').value.trim(),
        email: document.getElementById('signup-email').value.trim(),
        password: document.getElementById('signup-password').value
    };

    try {
        const res = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Confirm your mail & remember your credentials.", "success");
            switchAuthTab('login');
            document.getElementById('login-email').value = payload.email;
            document.getElementById('signup-form').reset();
        } else {
            showToast(`Registration Failed: ${formatBackendError(data.detail)}`, "error");
        }
    } catch (err) {
        showToast("Server communication error.", "error");
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const payload = {
        email: document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-password').value
    };

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = { token: data.access_token, name: data.name };
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('user_name', data.name);
            updateUIForUser();
            authModal.classList.add('hidden');
            showToast(`Authentication successful. Welcome, ${data.name}.`, "success");
        } else {
            showToast(`Access Denied: ${formatBackendError(data.detail)}`, "error");
        }
    } catch (err) {
        showToast("Server communication error.", "error");
    }
}

function handleLogout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_name');
    currentUser = null;
    updateUIForUser();
    showToast("Logged out successfully.", "success");
}

// --- Course Logic ---
async function fetchCourses() {
    try {
        const response = await fetch('/api/courses');
        if (!response.ok) throw new Error("Backend connection failed.");
        courses = await response.json();
    } catch (error) {
        console.error("Failed to fetch courses:", error);
        courses = null; 
    }
}

// --- NEW: Real-time Search Filter ---
function filterCourses() {
    const query = document.getElementById('search-bar').value.toLowerCase();
    const filtered = courses.filter(course => 
        course.title.toLowerCase().includes(query) || 
        (course.instructor && course.instructor.toLowerCase().includes(query))
    );
    renderCourses(filtered);
}

// UPDATED: Now accepts a parameter so the search filter can dynamically change the DOM
function renderCourses(coursesToRender = courses) {
    courseGrid.innerHTML = '';
    
    if (coursesToRender === null) {
        courseGrid.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 2rem; border: 1px dashed var(--accent-rose); border-radius: 8px; text-align: center;">
                <h3 style="color: var(--accent-rose); margin-bottom: 0.5rem;">⚠ SYSTEM OFFLINE</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;"> Database is Sleeping .. </p>
            </div>
        `;
        return;
    }

    if (coursesToRender.length === 0) {
        courseGrid.innerHTML = `<p style="color: var(--text-muted);">No courses match your search.</p>`;
        return;
    }

    coursesToRender.forEach((course, index) => {
        const seats = course.seats !== undefined ? course.seats : course.available_seats;
        const isAvailable = seats > 0;
        
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <span class="card-tag">MODULE // 0${index + 1}</span>
            <h3>${course.title}</h3>
            <div class="card-info">
                <p>Instructor: <strong style="color: var(--text-primary);">${course.instructor || 'Unassigned'}</strong></p>
            </div>
            <div class="card-footer">
                <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">SLOTS: ${seats}</span>
                <span class="seat-pill ${isAvailable ? 'open' : 'full'}">${isAvailable ? '● OPEN' : '✕ FULL'}</span>
            </div>
        `;
        
        card.onclick = () => {
            showCourseDetail(course);
            if (!currentUser) {
                authModal.classList.remove('hidden');
                showToast("Login to enroll.", "error");
            }
        };
        
        courseGrid.appendChild(card);
    });
}

function showCourseDetail(course) {
    const seats = course.seats !== undefined ? course.seats : course.available_seats;
    const isAvailable = seats > 0;

    courseContent.innerHTML = `
        <div class="spec-header">
            <span class="card-tag">DETAILED_SPECIFICATION</span>
            <h2>${course.title}</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Lead Instructor: ${course.instructor || 'TBD'}</p>
        </div>

        <div class="terminal-box">
            <div class="terminal-title">// COURSE_SYLLABUS_MODULES</div>
            <ul>
                <li>Architecture Overview & System Prerequisites</li>
                <li>Data Pipeline Synchronization & Concurrent Transaction Execution</li>
                <li>Production Evaluation, Security Auditing & Capstone Build</li>
            </ul>
        </div>

        <div class="register-section">
            <h3 style="font-family: var(--font-mono); font-size: 1.1rem;">INITIALIZE_ENROLLMENT</h3>
            <button class="btn-primary" onclick="handleRegistration(${course.id})" ${!isAvailable ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                ${isAvailable ? `EXECUTE_REGISTRATION (${seats} SEATS LEFT)` : 'COURSE_SEATS_EXHAUSTED'}
            </button>
        </div>
    `;

    // Ensure we hide all other views, including dashboards
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });
    
    detailView.classList.remove('hidden');
    detailView.classList.add('active');
    window.scrollTo(0, 0);
}

async function handleRegistration(courseId) {
    if (!currentUser) {
        authModal.classList.remove('hidden');
        showToast("AUTH_REQUIRED: Please log in to secure your enrollment.", "error");
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}` 
            },
            body: JSON.stringify({ course_id: courseId })
        });

        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message, "success");
            await fetchCourses(); 
            renderCourses();
            showCatalog();
        } else {
            showToast(`Registration Error: ${result.detail}`, "error");
        }
    } catch (error) {
        showToast("Server Error: Unable to communicate with FastAPI backend.", "error");
    }
}

// --- NEW: Dashboard API Mocks (Pre-Backend Integration) ---
async function fetchStudentDashboard() {
    const grid = document.getElementById('student-grid');
    grid.innerHTML = '<div class="terminal-box" style="grid-column: 1 / -1; text-align: center; color: var(--accent-cyan);">Fetching enrollment data...</div>';
    
    try {
        // Will fail gracefully until the Python backend route is written
        const res = await fetch('/api/my-enrollments', {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!res.ok) throw new Error();
        
        const enrollments = await res.json();
        // UI rendering logic will go here once the backend passes the data
    } catch (e) {
        grid.innerHTML = '<div class="terminal-box" style="grid-column: 1 / -1; text-align: center; border-color: var(--accent-rose);"><span style="color: var(--accent-rose);">⚠ OFFLINE:</span> Backend route "/api/my-enrollments" not yet implemented.</div>';
    }
}

async function fetchAdminDashboard() {
    const tableBody = document.getElementById('admin-table-body');
    tableBody.innerHTML = '';
    
    if (!courses || courses.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No course data available.</td></tr>';
        return;
    }

    // Reuse the catalog data for the admin table
    courses.forEach(course => {
        tableBody.innerHTML += `
            <tr>
                <td style="font-family: var(--font-mono); color: var(--text-muted);">${String(course.id).substring(0,8)}</td>
                <td style="font-weight: 600;">${course.title}</td>
                <td>${course.instructor || 'Unassigned'}</td>
                <td>${course.available_seats !== undefined ? course.available_seats : course.seats}</td>
                <td>
                    <button class="btn-auth" style="background: rgba(244, 63, 94, 0.1); color: var(--accent-rose); border: 1px solid var(--accent-rose);" onclick="showToast('Backend deletion pending integration.', 'error')">DELETE</button>
                </td>
            </tr>
        `;
    });
}

function openAddCourseModal() {
    showToast("Admin Add Course form pending backend integration.", "success");
}

// Boot up the application
init();