let courses = [];

const catalogView = document.getElementById('catalog-view');
const detailView = document.getElementById('detail-view');
const courseGrid = document.getElementById('course-grid');
const courseContent = document.getElementById('course-content');

async function init() {
    await fetchCourses();
    renderCourses();
}

async function fetchCourses() {
    try {
        const response = await fetch('/api/courses');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        courses = await response.json();
    } catch (error) {
        console.error("Failed to load courses from API:", error);
        courseGrid.innerHTML = `<p style="color: var(--accent-rose); font-family: var(--font-mono);">[ERROR] Failed to fetch data from Python API.</p>`;
    }
}

function renderCourses() {
    if (!courses || courses.length === 0) {
        courseGrid.innerHTML = `<p style="font-family: var(--font-mono); color: var(--text-muted);">[NULL] No courses found in database.</p>`;
        return;
    }

    const countElem = document.getElementById('total-courses-count');
    if (countElem) countElem.textContent = courses.length;

    courseGrid.innerHTML = '';
    courses.forEach((course, index) => {
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
                <span class="seat-pill ${isAvailable ? 'open' : 'full'}">
                    ${isAvailable ? '● OPEN' : '✕ FULL'}
                </span>
            </div>
        `;
        card.onclick = () => showCourseDetail(course);
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
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">
                Atomic transaction check via PostgreSQL RPC function.
            </p>
            <button class="btn-primary" onclick="handleRegistration(${course.id})" ${!isAvailable ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                ${isAvailable ? `EXECUTE_REGISTRATION (${seats} SEATS LEFT)` : 'COURSE_SEATS_EXHAUSTED'}
            </button>
        </div>
    `;

    catalogView.classList.remove('active');
    catalogView.classList.add('hidden');
    detailView.classList.remove('hidden');
    detailView.classList.add('active');
    window.scrollTo(0, 0);
}

function showCatalog() {
    detailView.classList.remove('active');
    detailView.classList.add('hidden');
    catalogView.classList.remove('hidden');
    catalogView.classList.add('active');
}

async function handleRegistration(courseId) {
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ course_id: courseId })
        });

        const result = await response.json();
        
        if (response.ok) {
            alert("SUCCESS: " + result.message);
            await fetchCourses(); 
            renderCourses();
            showCatalog();
        } else {
            alert(`TRANSACTION_FAILED: ${result.detail}`);
        }
    } catch (error) {
        console.error("Registration request failed:", error);
        alert("SERVER_ERROR: Unable to communicate with FastAPI backend.");
    }
}

init();