<template>
  <div class="teacher-dashboard">
    <header class="dashboard-header">
      <div>
        <h1>Educator <span>Portal</span></h1>
        <p class="subtitle">Design interactive worksheets, assign tasks, and sync grades to Teams.</p>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <button
          v-if="currentUser?.role === 'admin'"
          @click="async () => { await fetchAdminSettings();    await fetchAdminUsers(); await fetchTeacherToken(); showAdminConsole = true; }"
          class="btn btn-secondary"
          title="Administrator Console"
          style="padding: 8px 14px; font-size: 1.1rem;"
        >⚙️</button>
        <router-link to="/teacher/builder" class="btn btn-primary">
          <span>＋</span> Create Worksheet
        </router-link>
      </div>
    </header>

    <div v-if="error" class="error-banner">
      <span>⚠️</span> {{ error }}
    </div>

    <div class="insight-cards">
      <div class="insight-card card">
        <h3>🚨 At-risk Students</h3>
        <p class="insight-value">{{ atRiskStudents.length }}</p>
      </div>
      <div class="insight-card card">
        <h3>🧩 Intervention Groups</h3>
        <p class="insight-value">{{ interventionGroups.length }}</p>
      </div>
      <div class="insight-card card">
        <h3>📊 Completion</h3>
        <p class="insight-value">{{ teacherAnalytics?.overview?.completedSubmissions || 0 }}</p>
      </div>
      <div class="insight-card card">
        <h3>📉 Lowest Performing Subject</h3>
        <p class="insight-value">{{ lowestPerformingSubject }}</p>
      </div>
    </div>

    <!-- Main Navigation tabs -->
    <div class="tabs">
      <button 
        v-for="tab in availableTabs" 
        :key="tab"
        @click="switchTab(tab)"
        :class="['tab-btn', { active: activeTab === tab }]"
      >
        {{ tab === 'worksheets' ? 'Worksheets' : tab === 'assignments' ? 'Assignments' : tab === 'classes' ? 'Classes & Groups' : tab === 'courses' ? 'Courses' : 'Templates Library' }}
      </button>
    </div>
    <!-- Worksheets Tab -->
    <div v-if="activeTab === 'worksheets'" class="tab-content">
      <div v-if="loading" class="spinner-container">
        <div class="spinner"></div>
      </div>
      <div v-else-if="worksheets.length === 0" class="empty-state card glass">
        <span>📝</span>
        <h3>No Worksheets Yet</h3>
        <p>Start by creating your first interactive exercise sheet or use one of our templates.</p>
        <div class="empty-actions">
          <router-link to="/teacher/builder" class="btn btn-primary">Create Blank Worksheet</router-link>
          <button @click="switchTab('templates')" class="btn btn-secondary">Browse Templates Library 📚</button>
        </div>
      </div>
      <div v-else>
        <!-- Search & Filter Bar -->
        <div class="ws-filter-bar card" style="margin-bottom: 16px; padding: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
          <input type="text" v-model="worksheetSearch" placeholder="Search worksheets..." style="flex: 1; min-width: 200px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-main);" />
          <select v-model="worksheetStatusFilter" style="padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-main);">
            <option value="">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
          <input type="text" v-model="worksheetTagFilter" placeholder="Filter by tag..." style="width: 140px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-main);" />
        </div>
        <div class="table-container card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Subject</th>
              <th>Level</th>
              <th>Tags</th>
              <th>Total Points</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sheet in filteredWorksheets" :key="sheet.id">
              <td class="font-bold">{{ sheet.title }}</td>
              <td>{{ sheet.subject || 'General' }}</td>
              <td>{{ sheet.grade_level || 'All' }}</td>
              <td>
                <span v-if="sheet.tags" v-for="tag in sheet.tags.split(',').filter(t => t.trim())" :key="tag" class="tag-badge">{{ tag.trim() }}</span>
              </td>
              <td>{{ sheet.total_points }} pts</td>
              <td>
                <span :class="['badge', sheet.is_published ? 'badge-success' : 'badge-warning']">
                  {{ sheet.is_published ? 'Published' : 'Draft' }}
                </span>
              </td>
              <td>
                <div class="action-buttons">
                  <button @click="openAssignModal(sheet)" class="btn-icon" title="Assign to Class">
                    <span>📢</span>
                  </button>
                  <router-link :to="`/teacher/preview/${sheet.id}`" class="btn-icon" title="Preview Worksheet">
                    <span>👀</span>
                  </router-link>
                  <router-link :to="`/teacher/builder/${sheet.id}`" class="btn-icon" title="Edit Worksheet">
                    <span>✏️</span>
                  </router-link>
                  <button @click="duplicateWorksheet(sheet.id)" class="btn-icon" title="Duplicate Worksheet">
                    <span>📋</span>
                  </button>
                  <button @click="deleteWorksheet(sheet.id)" class="btn-icon btn-icon-danger" title="Delete">
                    <span>🗑️</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>
    <!-- Courses Tab (New) -->
    <div v-if="activeTab === 'courses'" class="tab-content">
      <div class="content-header" style="display: flex; justify-content: space-between; margin-bottom: 20px;">
        <h2>Your Courses</h2>
        <button @click="showCreateCourseModal = true" class="btn btn-primary">
          ＋ Create Course
        </button>
      </div>

      <div v-if="loading" class="spinner-container">
        <div class="spinner"></div>
      </div>
      
      <div v-else-if="courses.length === 0" class="empty-state card glass">
        <span>📚</span>
        <h3>No Courses Created</h3>
        <p>Group multiple worksheets together into a sequential course for your students.</p>
        <button @click="showCreateCourseModal = true" class="btn btn-primary">Create Course</button>
      </div>

      <div v-else class="classes-grid">
        <div v-for="course in courses" :key="course.id" @click="selectCourse(course)" class="class-card card glass clickable">
          <div class="class-card-header">
            <h3>{{ course.title }}</h3>
            <button @click.stop="deleteCourse(course.id)" class="btn-icon btn-icon-danger" title="Delete Course">
              <span>🗑️</span>
            </button>
          </div>
          <div class="class-card-body">
            <p class="pupils-count">📄 <strong>{{ course.worksheet_count || 0 }}</strong> worksheets</p>
            <p v-if="course.description" class="course-desc" style="font-size: 0.9rem; color: var(--text-muted); margin-top: 8px;">
              {{ course.description.substring(0, 60) }}{{ course.description.length > 60 ? '...' : '' }}
            </p>
            <span class="text-link" style="margin-top: 12px; display: inline-block;">Manage Course →</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Course Detail View -->
    <div v-if="activeTab === 'course-detail' && selectedCourseDetail" class="class-detail-section">
      <div class="detail-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <button @click="activeTab = 'courses'; selectedCourseDetail = null" class="btn btn-secondary btn-sm">
          ← Back to Courses
        </button>
        <div class="class-title-info">
          <h2>Course: <span>{{ selectedCourseDetail.title }}</span></h2>
          <p class="student-subtitle">📄 {{ selectedCourseDetail.worksheets.length }} worksheets</p>
        </div>
        <div>
          <button @click="openAssignCourseModal(selectedCourseDetail)" class="btn btn-primary">
            📢 Assign Course
          </button>
        </div>
      </div>

      <div class="class-section card glass">
        <div class="class-section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3>Course Worksheets</h3>
          <div class="roster-actions" style="display: flex; gap: 8px;">
            <select v-model="selectedWorksheetToAdd" class="form-control" style="max-width: 250px;">
              <option value="">-- Select Worksheet --</option>
              <option v-for="ws in worksheets" :key="ws.id" :value="ws.id">{{ ws.title }}</option>
            </select>
            <button @click="addWorksheetToCourse" :disabled="!selectedWorksheetToAdd" class="btn btn-secondary btn-sm">
              ＋ Add to Course
            </button>
          </div>
        </div>

        <div v-if="selectedCourseDetail.worksheets.length === 0" class="matrix-placeholder" style="text-align: center; padding: 20px;">
          <p>No worksheets added to this course yet.</p>
        </div>
        <div v-else class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Title</th>
                <th>Points</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(ws, index) in selectedCourseDetail.worksheets" :key="ws.worksheet_id || ws.id">
                <td>#{{ index + 1 }}</td>
                <td class="font-bold">{{ ws.title }}</td>
                <td>{{ ws.total_points }} pts</td>
                <td>
                  <button @click="removeWorksheetFromCourse(ws.worksheet_id || ws.id)" class="btn-icon btn-icon-danger" title="Remove from Course">
                    <span>❌</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Assignments Tab -->
    <div v-if="activeTab === 'assignments'" class="tab-content">
      <div v-if="loading" class="spinner-container">
        <div class="spinner"></div>
      </div>
      <div v-else-if="assignments.length === 0" class="empty-state card glass">
        <span>📢</span>
        <h3>No Active Assignments</h3>
        <p>Assign a worksheet to a class or channel to see it here.</p>
      </div>
      <div v-else class="assignments-list">
        <div v-for="assignment in assignments" :key="assignment.id" class="assignment-item card">
          <div class="assignment-info">
            <h3>{{ assignment.worksheet_title || 'Worksheet Task' }}</h3>
            <p class="class-info">Class: <strong>{{ assignment.class_name }}</strong></p>
            <p class="due-info">Due: <strong>{{ formatDate(assignment.due_date) }}</strong></p>
            <p class="code-info">Share code with students: <code class="share-code">{{ assignment.id }}</code></p>
          </div>

          <div class="assignment-stats">
            <div class="stat">
              <span class="stat-num">{{ assignment.submission_count || 0 }}</span>
              <span class="stat-label">Submissions</span>
            </div>
            <div class="stat-actions">
              <button @click="viewResults(assignment.id)" class="btn btn-secondary btn-sm">
                View Results 📊
              </button>
              <button @click="fetchAssignmentStats(assignment.id)" class="btn btn-secondary btn-sm">
                Stats 📈
              </button>
              <button @click="deleteAssignmentItem(assignment.id, assignment.worksheet_id)" class="btn btn-secondary btn-sm" style="background: var(--danger-light); color: var(--danger);">
                🗑️ Delete
              </button>
              <button 
                v-if="assignment.teams_assignment_id" 
                @click="syncGrades(assignment.id)" 
                class="btn btn-primary btn-sm"
              >
                Sync to Teams 🔄
              </button>
              <button 
                v-else 
                @click="createTeamsAssignment(assignment.id)" 
                class="btn btn-secondary btn-sm btn-outline-teams"
              >
                Link to Teams 📁
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Classes Tab -->
    <div v-if="activeTab === 'classes'" class="tab-content">
      <div v-if="loading" class="spinner-container">
        <div class="spinner"></div>
      </div>
      
      <!-- Class List View -->
      <div v-else-if="!selectedClassId" class="classes-overview-section">
        <div class="section-actions-header">
          <h2>Classes & Groups</h2>
          <div style="display: flex; gap: 8px;">
            <button @click="triggerPdfUpload" class="btn btn-secondary">
              <span>📄</span> Import PDF List
            </button>
            <input type="file" ref="pdfInput" @change="handlePdfUpload" accept="application/pdf" style="display: none;" />
            <button @click="showCreateClassModal = true" class="btn btn-primary">
              <span>＋</span> Create Class
            </button>
          </div>
        </div>

        <div v-if="classes.length === 0" class="empty-state card glass">
          <span>👥</span>
          <h3>No Classes Created</h3>
          <p>Create a class group to assign worksheets and compare students' progress.</p>
        </div>
        
        <div v-else class="classes-grid">
          <div v-for="cls in classes" :key="cls.id" @click="selectClass(cls.id)" class="class-card card glass clickable">
            <div class="class-card-header">
              <h3>{{ cls.name }}</h3>
              <button @click.stop="deleteClass(cls.id)" class="btn-icon btn-icon-danger" title="Delete Class">
                <span>🗑️</span>
              </button>
            </div>
            <div class="class-card-body">
              <p class="pupils-count">👥 <strong>{{ cls.student_count || 0 }}</strong> pupils enrolled</p>
              <div class="class-code-row" style="margin: 8px 0; display: flex; align-items: center; gap: 8px;">
                <code style="font-size: 11px; background: var(--primary-light); color: var(--primary); padding: 2px 6px; border-radius: 4px;">{{ cls.class_code }}</code>
                <button @click.stop="copyClassCode(cls.class_code)" class="btn-sm" style="font-size: 11px; padding: 2px 8px; background: var(--primary-light); color: var(--primary); border: 1px solid var(--primary); border-radius: 4px; cursor: pointer; min-height: auto; box-shadow: none;">Copy Code</button>
              </div>
              <span class="text-link">View Progress Matrix & Roster →</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Class Detail View -->
      <div v-else-if="selectedClassDetail" class="class-detail-section">
        <div class="detail-header">
          <button @click="selectedClassId = null; selectedClassDetail = null" class="btn btn-secondary btn-sm">
            ← Back to Classes
          </button>
          <div class="class-title-info">
            <h2>Class: <span>{{ selectedClassDetail.class.name }}</span></h2>
            <p class="student-subtitle">👥 {{ selectedClassDetail.matrix.length }} pupils registered</p>
          </div>
        </div>

        <!-- Section 1: Progress Matrix -->
        <div class="class-section card">
        <div class="class-section-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <h3>📈 Class Progress Matrix</h3>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span class="helper-text">Visual performance grid for all assignments in this class.</span>
              <button @click="exportClassCSV(selectedClassId)" class="btn btn-secondary btn-sm">📥 Export CSV</button>
            </div>
          </div>

          <div v-if="selectedClassDetail.assignments.length === 0" class="matrix-placeholder">
            <p>No worksheets have been assigned to this class yet.</p>
            <button @click="activeTab = 'worksheets'" class="btn btn-secondary btn-sm">Go to Worksheets to Assign</button>
          </div>
          <div v-else class="matrix-table-container">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th class="sticky-col first-col">Student Name</th>
                  <th v-for="assign in selectedClassDetail.assignments" :key="assign.assignment_id" class="assignment-header-col">
                    <div class="assign-title" :title="assign.title">{{ assign.title }}</div>
                    <div class="assign-points">{{ assign.total_points }} pts</div>
                  </th>
                  <th>Completion</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in selectedClassDetail.matrix" :key="row.student_id">
                  <td class="font-bold sticky-col first-col">{{ row.name }}</td>
                  <td v-for="assign in selectedClassDetail.assignments" :key="assign.assignment_id">
                    <div class="cell-content">
                      <span v-if="row.submissions[assign.assignment_id].status === 'completed'" class="status-badge status-completed" :title="'Submitted on ' + formatDate(row.submissions[assign.assignment_id].submitted_at)">
                        ✅ {{ row.submissions[assign.assignment_id].score }}/{{ row.submissions[assign.assignment_id].max_score }}
                      </span>
                      <span v-else-if="row.submissions[assign.assignment_id].status === 'in_progress'" class="status-badge status-progress">
                        ⏳ Started
                      </span>
                      <span v-else class="status-badge status-notstarted">
                        ❌ Not Started
                      </span>
                    </div>
                  </td>
                  <td class="font-semibold">{{ calculateStudentCompletion(row, selectedClassDetail.assignments) }}%</td>
                </tr>
                <!-- Class Averages Row -->
                <tr class="averages-row">
                  <td class="font-bold sticky-col first-col">Class Average</td>
                  <td v-for="assign in selectedClassDetail.assignments" :key="assign.assignment_id">
                    <span class="average-badge">
                      {{ calculateClassAverage(selectedClassDetail.matrix, assign.assignment_id) }}%
                    </span>
                  </td>
                  <td class="font-bold">
                    {{ calculateClassOverallCompletion(selectedClassDetail.matrix, selectedClassDetail.assignments) }}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section: Announcements -->
        <div class="class-section card" style="margin-top: 20px;">
          <div class="class-section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3>📢 Class Announcements</h3>
          </div>
          <form @submit.prevent="postAnnouncement" style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            <input type="text" v-model="newAnnouncement" placeholder="Post an announcement to students..." style="flex: 1; min-width: 200px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-main);" />
            <button type="submit" class="btn btn-primary btn-sm" :disabled="!newAnnouncement.trim()">Post</button>
          </form>
          <div v-if="classAnnouncements.length === 0" style="color: var(--text-muted); font-size: 14px; padding: 8px 0;">No announcements yet.</div>
          <div v-for="ann in classAnnouncements" :key="ann.id" style="display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 8px; background: var(--bg-main);">
            <div>
              <p style="margin: 0; font-size: 14px;">{{ ann.message }}</p>
              <small style="color: var(--text-muted);">{{ new Date(ann.created_at).toLocaleString() }}</small>
            </div>
            <button @click="deleteAnnouncement(ann.id)" class="btn-sm" style="background: none; border: none; cursor: pointer; color: var(--danger); font-size: 16px; min-height: auto; box-shadow: none; padding: 0 4px;">×</button>
          </div>
        </div>

        <!-- Section 2: Student Roster Management -->
        <div class="class-section card">
          <div class="class-section-header">
            <h3>👥 Student Roster</h3>
            <div class="roster-actions">
              <button @click="openAddStudentModal" class="btn btn-secondary btn-sm">
                ＋ Add Existing Pupil
              </button>
              <button @click="openCreateStudentModal" class="btn btn-primary btn-sm">
                ＋ Register New Pupil
              </button>
              <button @click="showImportCSVModal = true; csvPreview = []" class="btn btn-secondary btn-sm">
                📤 Import CSV
              </button>
            </div>
          </div>

          <div v-if="selectedClassDetail.matrix.length === 0" class="empty-state-roster">
            <p>No students enrolled in this class yet. Click "Add Existing Pupil" or "Register New Pupil" to enroll students.</p>
          </div>
          <div v-else class="roster-grid">
            <div v-for="student in selectedClassDetail.matrix" :key="student.student_id" class="roster-student-item">
              <div class="student-initials">
                {{ student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() }}
              </div>
              <div class="student-details">
                <span class="student-name font-bold">{{ student.name }}</span>
                <span class="student-email">{{ student.email }}</span>
              </div>
              <button @click="removeStudent(student.student_id)" class="btn-remove-roster" title="Remove from class">
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Templates Tab -->
    <div v-if="activeTab === 'templates'" class="tab-content">
      <div v-if="loading" class="spinner-container">
        <div class="spinner"></div>
      </div>
      <div v-else class="templates-overview">
        <div class="section-actions-header">
          <h2>Templates Library 📚</h2>
          <p class="subtitle">Select a subject to browse high-quality pre-made worksheets. You can edit worksheets after cloning.</p>
        </div>

        <!-- Subject tabs selector -->
        <div class="subject-tabs-wrapper">
          <div class="subject-row">
            <button 
              v-for="sub in ['Englisch', 'Mathematik', 'Deutsch']" 
              :key="sub" 
              @click="selectedTemplateSubject = sub"
              :class="['subject-tab-btn', { active: selectedTemplateSubject === sub }]"
            >
              <span class="subject-icon">{{ getSubjectIcon(sub) }}</span>
              <span class="subject-name">{{ sub }}</span>
            </button>
          </div>
          <div class="subject-row">
            <button 
              v-for="sub in ['Geographie', 'Biologie', 'Chemie', 'Physik']" 
              :key="sub" 
              @click="selectedTemplateSubject = sub"
              :class="['subject-tab-btn', { active: selectedTemplateSubject === sub }]"
            >
              <span class="subject-icon">{{ getSubjectIcon(sub) }}</span>
              <span class="subject-name">{{ sub }}</span>
            </button>
          </div>
        </div>

        <div v-if="filteredTemplates.length === 0" class="empty-state card glass">
          <div class="empty-icon">📝</div>
          <h3>No Templates Found</h3>
          <p>No templates have been created for "{{ selectedTemplateSubject }}" yet.</p>
        </div>

        <div v-else class="templates-grid">
          <div v-for="tpl in filteredTemplates" :key="tpl.id" class="template-card card glass">
            <div class="template-tag">{{ tpl.subject || 'Allgemein' }}</div>
            <h3>{{ tpl.title }}</h3>
            <p class="template-desc">{{ tpl.description }}</p>
            <div class="template-meta">
              <span class="meta-item">🎯 {{ tpl.grade_level }}</span>
              <span class="meta-item">✏️ {{ tpl.content?.blocks?.length ?? 0 }} exercises</span>
            </div>
            <button @click="useTemplate(tpl.id)" class="btn btn-primary btn-block btn-template-action">
              ⚡ Clone Worksheet
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Administrator Console Modal -->
    <div v-if="showAdminConsole" class="modal-overlay">
      <div class="modal modal-lg card">
        <div class="modal-header">
          <h2>Administrator Console ⚙️</h2>
          <button @click="showAdminConsole = false" class="btn-close">×</button>
        </div>
        <div class="settings-overview" style="max-height: 80vh; overflow-y: auto; padding: 8px 0;">
          <div class="settings-grid">
            
            <!-- Teacher Registration Link Card -->
            <div class="settings-card card glass" style="margin-bottom: 24px;">
              <h3>Teacher Self-Registration</h3>
              <p class="card-desc" style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 16px;">
                Share this link with educators to allow them to create their own accounts.
              </p>
              <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <input type="text" readonly :value="teacherRegistrationUrl" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255, 255, 255, 0.05); color: var(--text-color);" />
                <button @click="copyTeacherLink" class="btn btn-secondary">Copy</button>
              </div>
              <button @click="generateNewTeacherToken" class="btn btn-danger btn-sm">Regenerate Link (Revokes old link)</button>
            </div>
            <!-- Auth Configuration Card -->
            <div class="settings-card card glass" style="margin-bottom: 24px;">
              <h3>Authentication Configuration</h3>
              <p class="card-desc" style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 16px;">
                Control how educators and students log in to the portal.
              </p>
              
              <form @submit.prevent="saveAuthSettings" class="settings-form">
                <div class="form-group">
                  <label style="display: block; margin-bottom: 12px; font-weight: 500;">Authentication Mode</label>
                  <div class="radio-group" style="display: flex; flex-direction: column; gap: 12px;">
                    <label class="radio-label" style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer;">
                      <input type="radio" value="local" v-model="settingsForm.auth_mode" style="margin-top: 4px;" />
                      <span class="radio-text">
                        <strong style="display: block; font-size: 0.95rem;">Local Credentials (Default)</strong>
                        <span class="help-text" style="display: block; font-size: 0.8rem; color: var(--text-muted);">Users login with a local username/email and password.</span>
                      </span>
                    </label>
                    <label class="radio-label" style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer;">
                      <input type="radio" value="microsoft" v-model="settingsForm.auth_mode" style="margin-top: 4px;" />
                      <span class="radio-text">
                        <strong style="display: block; font-size: 0.95rem;">Microsoft Entra ID (SSO)</strong>
                        <span class="help-text" style="display: block; font-size: 0.8rem; color: var(--text-muted);">Users login via school Microsoft 365 Single Sign-On.</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div class="settings-action">
                  <button type="submit" class="btn btn-primary" :disabled="savingSettings">
                    {{ savingSettings ? 'Saving...' : 'Save Configuration 💾' }}
                  </button>
                </div>
              </form>
            </div>

            <!-- AI Configuration Card -->
            <div class="settings-card card glass" style="margin-bottom: 24px;">
              <h3>AI Generation Integrations</h3>
              <p class="card-desc" style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 16px;">
                Configure AI providers for worksheet generation (Gemini API and Ollama local LLM).
              </p>
              
              <form @submit.prevent="saveAiSettings" class="settings-form">
                <div class="form-group" style="margin-bottom: 12px;">
                  <label style="display: block; margin-bottom: 6px; font-weight: 500;">Gemini API Key</label>
                  <input type="password" v-model="aiSettingsForm.gemini_api_key" placeholder="Enter your Google Gemini API key" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255, 255, 255, 0.05); color: var(--text-color);" />
                </div>
                <div class="form-group" style="margin-bottom: 12px;">
                  <label style="display: block; margin-bottom: 6px; font-weight: 500;">Gemini Model</label>
                  <input type="text" v-model="aiSettingsForm.gemini_model" placeholder="gemini-2.5-flash" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255, 255, 255, 0.05); color: var(--text-color);" />
                </div>
                <div class="form-group" style="margin-bottom: 12px;">
                  <label style="display: block; margin-bottom: 6px; font-weight: 500;">Ollama Base URL</label>
                  <input type="text" v-model="aiSettingsForm.ollama_base_url" placeholder="http://localhost:11434" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255, 255, 255, 0.05); color: var(--text-color);" />
                </div>
                <div class="form-group" style="margin-bottom: 12px;">
                  <label style="display: block; margin-bottom: 6px; font-weight: 500;">Ollama Model Name</label>
                  <input type="text" v-model="aiSettingsForm.ollama_model" placeholder="llama3.1" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255, 255, 255, 0.05); color: var(--text-color);" />
                </div>

                <div class="settings-action" style="margin-top: 20px;">
                  <button type="submit" class="btn btn-primary" :disabled="savingAiSettings">
                    {{ savingAiSettings ? 'Saving...' : 'Save AI Config 🤖' }}
                  </button>
                </div>
              </form>
            </div>

            <!-- User Management Card -->
            <div class="settings-card card glass user-management-card">
              <div class="card-header-flex" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
                <div>
                  <h3>User Accounts Roster</h3>
                  <p class="card-desc" style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">
                    Create and modify accounts for students, teachers, and admins.
                  </p>
                </div>
                <button @click="openCreateUserModal" class="btn btn-primary btn-sm">
                  Register New User 👤
                </button>
              </div>

              <div class="search-bar-container" style="margin-bottom: 16px;">
                <input 
                  type="text" 
                  v-model="userSearchQuery" 
                  placeholder="Search name, username, or email..." 
                  class="form-control"
                  style="width: 100%; max-width: 400px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255, 255, 255, 0.05); color: var(--text-color);"
                />
              </div>

              <div class="table-container" style="overflow-x: auto; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid var(--border-color);">
                <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
                  <thead>
                    <tr style="border-bottom: 1px solid var(--border-color); background: rgba(255, 255, 255, 0.02);">
                      <th style="padding: 12px 16px;">Name</th>
                      <th style="padding: 12px 16px;">Username / Email</th>
                      <th style="padding: 12px 16px;">Role</th>
                      <th style="padding: 12px 16px;">Last Login</th>
                      <th style="padding: 12px 16px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="usr in filteredUsers" :key="usr.id" style="border-bottom: 1px solid var(--border-color);">
                      <td style="padding: 12px 16px;">
                        <strong>{{ usr.name }}</strong>
                        <span v-if="usr.id === currentUser?.id" class="badge badge-success" style="margin-left: 8px; background: #28a745; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; color: white;">You</span>
                      </td>
                      <td style="padding: 12px 16px;">
                        <div class="user-meta-field" style="font-size: 0.85rem; color: var(--text-color);">👤 {{ usr.username || 'N/A' }}</div>
                        <div class="user-meta-field" style="font-size: 0.85rem; color: var(--text-muted);">✉️ {{ usr.email || 'N/A' }}</div>
                      </td>
                      <td style="padding: 12px 16px;">
                        <span :class="['badge', usr.role === 'admin' ? 'badge-danger' : usr.role === 'teacher' ? 'badge-success' : 'badge-info']" style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                          {{ usr.role }}
                        </span>
                      </td>
                      <td style="padding: 12px 16px; font-size: 0.85rem; color: var(--text-muted);">
                        {{ usr.last_login ? new Date(usr.last_login).toLocaleString() : 'Never' }}
                      </td>
                      <td style="padding: 12px 16px;">
                        <div class="action-buttons-cell" style="display: flex; gap: 8px;">
                          <button @click="openEditUserModal(usr)" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.8rem;">Edit</button>
                          <button @click="openChangePasswordModal(usr)" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.8rem;">Password</button>
                          <button 
                            v-if="usr.id !== currentUser?.id" 
                            @click="deleteUserAccount(usr)" 
                            class="btn btn-danger btn-sm"
                            style="padding: 4px 8px; font-size: 0.8rem; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;"
                          >Delete</button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="filteredUsers.length === 0">
                      <td colspan="5" class="text-center" style="padding: 24px; text-align: center; color: var(--text-muted);">No users match your search.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Register User Modal (Admin Settings) -->
    <div v-if="showCreateUserModal" class="modal-overlay">
      <div class="modal card">
        <h2>Register New Account</h2>
        <form @submit.prevent="createUserAccount" class="modal-form">
          <div class="form-group">
            <label>Display Name</label>
            <input type="text" v-model="createUserForm.name" placeholder="e.g. Marie Meier" required />
          </div>
          <div class="form-group">
            <label>Username</label>
            <input type="text" v-model="createUserForm.username" placeholder="e.g. mariemeier" required />
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" v-model="createUserForm.email" placeholder="e.g. marie@school.com" required />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" v-model="createUserForm.password" placeholder="Enter password (default: learnflow123)" />
          </div>
          <div class="form-group">
            <label>System Role</label>
            <select v-model="createUserForm.role" class="form-select">
              <option value="student">Student (Pupil)</option>
              <option value="teacher">Teacher (Educator)</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div class="modal-buttons">
            <button type="button" @click="showCreateUserModal = false" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="savingUser">Register User</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit User Account Modal (Admin Settings) -->
    <div v-if="showEditUserModal" class="modal-overlay">
      <div class="modal card">
        <h2>Edit Account Profile</h2>
        <form @submit.prevent="updateUserAccount" class="modal-form">
          <div class="form-group">
            <label>Display Name</label>
            <input type="text" v-model="editUserForm.name" required />
          </div>
          <div class="form-group">
            <label>Username</label>
            <input type="text" v-model="editUserForm.username" required />
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" v-model="editUserForm.email" required />
          </div>
          <div class="form-group">
            <label>System Role</label>
            <select v-model="editUserForm.role" class="form-select">
              <option value="student">Student (Pupil)</option>
              <option value="teacher">Teacher (Educator)</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div class="modal-buttons">
            <button type="button" @click="showEditUserModal = false" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="savingUser">Save Changes</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Change Password Modal (Admin Settings) -->
    <div v-if="showChangePasswordModal" class="modal-overlay">
      <div class="modal card">
        <h2>Reset Account Password</h2>
        <p class="subtitle" style="margin-top: -10px; margin-bottom: 20px;">
          Set a new login password for user <strong>{{ selectedUserForPassword?.name }}</strong>.
        </p>
        <form @submit.prevent="changeUserPassword" class="modal-form">
          <div class="form-group">
            <label>New Password</label>
            <input type="password" v-model="newUserPassword" placeholder="Enter new password" required />
          </div>
          <div class="modal-buttons">
            <button type="button" @click="showChangePasswordModal = false" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="savingUser">Change Password</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Assign Worksheet Modal -->
    <div v-if="showAssignModal" class="modal-overlay">
      <div class="modal card">
        <h2>Assign Worksheet: <span>{{ selectedSheet?.title }}</span></h2>
        <form @submit.prevent="submitAssign" class="modal-form">
          <div class="form-group">
            <label>Link to Local Class (Optional)</label>
            <select v-model="selectedAssignClass" @change="onAssignClassChange" class="form-select">
              <option :value="null">-- Select Class or Keep Custom --</option>
              <option v-for="cls in classes" :key="cls.id" :value="cls">
                {{ cls.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>School Class Name</label>
            <input type="text" v-model="assignForm.class_name" placeholder="e.g. 3a English" required />
          </div>
          <div class="form-group">
            <label>Teams Class ID (Optional - for Teams Sync)</label>
            <input type="text" v-model="assignForm.class_id" placeholder="Copy Teams class ID" />
          </div>
          <div class="form-group">
            <label>Due Date</label>
            <input type="datetime-local" v-model="assignForm.due_date" required />
          </div>
          <div class="form-group">
            <label>Retry Policy</label>
            <select v-model="assignForm.retry_policy">
              <option value="single">Single attempt</option>
              <option value="best">Keep best score</option>
              <option value="latest">Use latest score</option>
              <option value="capped">Capped attempts</option>
            </select>
          </div>
          <div class="form-group" v-if="assignForm.retry_policy === 'capped'">
            <label>Max Attempts</label>
            <input type="number" min="1" v-model.number="assignForm.max_attempts" />
          </div>
          <div class="form-group">
            <label><input type="checkbox" v-model="assignForm.peer_review_enabled" /> Enable peer review</label>
          </div>
          <div class="modal-buttons">
            <button type="button" @click="showAssignModal = false" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Assign Worksheet</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Create Class Modal -->
    <div v-if="showCreateClassModal" class="modal-overlay">
      <div class="modal card">
        <h2>Create Class / Group</h2>
        <form @submit.prevent="createClass" class="modal-form">
          <div class="form-group">
            <label>Class Name</label>
            <input type="text" v-model="newClassName" placeholder="e.g. 3a English" required />
          </div>
          <div class="modal-buttons">
            <button type="button" @click="showCreateClassModal = false" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Class</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Student to Class Roster Modal -->
    <div v-if="showAddStudentModal" class="modal-overlay">
      <div class="modal modal-lg card">
        <div class="modal-header">
          <h2>Enroll Pupils in Class</h2>
          <button @click="showAddStudentModal = false" class="btn-close">×</button>
        </div>
        <div class="student-search-container">
          <input 
            type="text" 
            v-model="studentSearchQuery" 
            placeholder="Search registered students by name or email..." 
            class="student-search-input"
          />
        </div>
        <div class="student-enroll-list">
          <div v-for="student in filteredStudents" :key="student.id" class="student-enroll-item">
            <label class="checkbox-label">
              <input type="checkbox" :value="student.id" v-model="selectedStudentIds" />
              <div class="student-enroll-info">
                <span class="font-bold">{{ student.name }}</span>
                <span class="student-email">{{ student.email }}</span>
              </div>
            </label>
          </div>
          <div v-if="filteredStudents.length === 0" class="text-center pad-20">
            No students found matching "{{ studentSearchQuery }}".
          </div>
        </div>
        <div class="modal-buttons pad-top-20">
          <button type="button" @click="showAddStudentModal = false" class="btn btn-secondary">Close</button>
          <button @click="addStudents" class="btn btn-primary" :disabled="selectedStudentIds.length === 0">
            Add Selected Pupils ({{ selectedStudentIds.length }})
          </button>
        </div>
      </div>
    </div>

    <!-- Create Manual Student Modal -->
    <div v-if="showCreateStudentModal" class="modal-overlay">
      <div class="modal card">
        <h2>Register New Student</h2>
        <form @submit.prevent="createStudent" class="modal-form">
          <div class="form-group">
            <label>Name</label>
            <input type="text" v-model="newStudentForm.name" placeholder="e.g. Marie Meier" required />
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" v-model="newStudentForm.email" placeholder="e.g. marie.meier@school.com" required />
          </div>
          <div class="form-group">
            <label>Role</label>
            <select v-model="newStudentForm.role" class="form-select">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div class="modal-buttons">
            <button type="button" @click="showCreateStudentModal = false" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Register & Enroll</button>
          </div>
        </form>
      </div>
    </div>

    <!-- View Results Modal -->
    <div v-if="showResultsModal" class="modal-overlay">
      <div class="modal modal-lg card">
        <div class="modal-header">
          <h2>Student Submissions</h2>
          <button @click="showResultsModal = false" class="btn-close">×</button>
        </div>
        <div class="results-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Score</th>
                <th>Synced</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="res in currentResults" :key="res.id">
                <td>{{ res.student_name }}</td>
                <td>
                  <span class="badge badge-success">Submitted</span>
                </td>
                <td>{{ res.score }} / {{ res.max_score }}</td>
                <td>
                  <span :class="['badge', res.grade_synced ? 'badge-success' : 'badge-warning']">
                    {{ res.grade_synced ? 'Synced' : 'Local Only' }}
                  </span>
                </td>
                <td>
                  <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                    <button @click="viewSingleAnswers(res)" class="btn btn-secondary btn-sm">Inspect</button>
                    <input type="text" :value="res.feedback_text || ''" @blur="saveFeedback(res.id, $event.target.value)" placeholder="Add feedback..." style="padding: 4px 8px; font-size: 12px; border: 1px solid var(--border-color); border-radius: 4px; width: 160px; background: var(--bg-card); color: var(--text-main);" />
                  </div>
                </td>
              </tr>
              <tr v-if="currentResults.length === 0">
                <td colspan="5" class="text-center">No submissions yet for this assignment.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <!-- Assignment Stats Modal -->
    <div v-if="showStatsModal" class="modal-overlay">
      <div class="modal card">
        <div class="modal-header">
          <h2>Assignment Statistics</h2>
          <button @click="showStatsModal = false" class="btn-close">×</button>
        </div>
        <div v-if="currentStats" style="padding: 8px 0;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">
            <div style="text-align: center; padding: 12px; background: var(--primary-light); border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 800; color: var(--primary);">{{ currentStats.submitted }}/{{ currentStats.totalStudents }}</div>
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Submitted</div>
            </div>
            <div style="text-align: center; padding: 12px; background: var(--success-light); border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 800; color: var(--success);">{{ currentStats.avgPercentage }}%</div>
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Avg Grade</div>
            </div>
            <div style="text-align: center; padding: 12px; background: var(--warning-light); border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 800; color: var(--warning);">{{ currentStats.passRate }}%</div>
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Pass Rate</div>
            </div>
          </div>
          <h4 style="margin-bottom: 10px;">Score Distribution</h4>
          <div v-for="(count, range) in currentStats.scoreDistribution" :key="range" style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <span style="width: 60px; font-size: 12px; color: var(--text-muted);">{{ range }}%</span>
            <div style="flex: 1; height: 16px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
              <div :style="{ width: `${currentStats.submitted > 0 ? Math.round((count / currentStats.submitted) * 100) : 0}%`, height: '100%', background: 'var(--primary)', borderRadius: '4px' }"></div>
            </div>
            <span style="font-size: 12px; font-weight: 700; width: 24px; text-align: right;">{{ count }}</span>
          </div>
        </div>
        <div v-else style="text-align: center; padding: 24px; color: var(--text-muted);">Loading stats...</div>
        <div class="modal-buttons" style="margin-top: 16px;">
          <button @click="showStatsModal = false" class="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>

    <!-- Assign Course Modal -->
    <div v-if="showAssignCourseModal" class="modal-overlay">
      <div class="modal card">
        <div class="modal-header">
          <h2>Assign Course</h2>
          <button @click="showAssignCourseModal = false" class="btn-close">×</button>
        </div>
        <form @submit.prevent="assignCourseToClass" class="assign-form">
          <div class="form-group">
            <label>Select Target Class</label>
            <div class="class-picker-grid">
              <div 
                v-for="cls in classes" 
                :key="cls.id"
                @click="selectAssignCourseClass(cls)"
                :class="['class-picker-card', { selected: selectedAssignCourseClass?.id === cls.id }]"
              >
                <h4>{{ cls.name }}</h4>
                <p>👥 {{ cls.student_count || 0 }}</p>
              </div>
            </div>
            <p v-if="classes.length === 0" class="no-classes-msg">No classes created. Please create one in the Classes tab first.</p>
          </div>
          
          <div class="form-group" v-if="selectedAssignCourseClass">
            <label>Due Date (Optional)</label>
            <input type="datetime-local" v-model="assignCourseForm.due_date" class="form-control" />
          </div>

          <div class="modal-buttons" style="margin-top: 24px;">
            <button type="button" @click="showAssignCourseModal = false" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="!selectedAssignCourseClass">
              Assign Course 📢
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- CSV Import Modal -->
    <div v-if="showImportCSVModal" class="modal-overlay">
      <div class="modal card">
        <div class="modal-header">
          <h2>Import Students from CSV</h2>
          <button @click="showImportCSVModal = false" class="btn-close">×</button>
        </div>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Upload a CSV file with columns: name, email (and optionally: username, password)</p>
        <input type="file" accept=".csv" @change="handleCSVUpload" style="margin-bottom: 16px;" />
        <div v-if="csvPreview.length > 0" style="margin-bottom: 16px; max-height: 200px; overflow-y: auto;">
          <p style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Preview ({{ csvPreview.length }} students):</p>
          <div v-for="(row, idx) in csvPreview.slice(0, 5)" :key="idx" style="font-size: 12px; padding: 4px 8px; border-bottom: 1px solid var(--border-color);">
            {{ row.name }} — {{ row.email }}
          </div>
          <div v-if="csvPreview.length > 5" style="font-size: 12px; color: var(--text-muted); padding: 4px 8px;">...and {{ csvPreview.length - 5 }} more</div>
        </div>
        <div class="modal-buttons">
          <button type="button" @click="showImportCSVModal = false" class="btn btn-secondary">Cancel</button>
          <button @click="importCSVStudents" class="btn btn-primary" :disabled="csvPreview.length === 0 || importingCSV">
            {{ importingCSV ? 'Importing...' : `Import ${csvPreview.length} Students` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create Course Modal -->
    <div v-if="showCreateCourseModal" class="modal-overlay">
      <div class="modal card">
        <div class="modal-header">
          <h2>Create New Course</h2>
          <button @click="showCreateCourseModal = false" class="btn-close">×</button>
        </div>
        <form @submit.prevent="createCourse" class="auth-form">
          <div class="form-group">
            <label>Course Title</label>
            <input type="text" v-model="newCourseForm.title" placeholder="e.g. English Grammar 101" required />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="newCourseForm.description" placeholder="Optional description..." rows="3"></textarea>
          </div>
          <div class="modal-buttons">
            <button type="button" @click="showCreateCourseModal = false" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Course</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue'

const worksheets = ref([])
const assignments = ref([])
const loading = ref(true)
const error = ref(null)
const activeTab = ref('worksheets')

const currentUser = ref(null)

// Computed availableTabs based on role
const availableTabs = computed(() => {
  return ['worksheets', 'courses', 'assignments', 'classes', 'templates']
})

const showAdminConsole = ref(false)

// Settings State
const settingsForm = ref({ auth_mode: 'local' })
const savingSettings = ref(false)
const aiSettingsForm = ref({ gemini_api_key: '', gemini_model: 'gemini-2.5-flash', ollama_base_url: 'http://localhost:11434', ollama_model: 'llama3.1' })
const savingAiSettings = ref(false)

const teacherRegistrationToken = ref('')
const teacherRegistrationUrl = computed(() => {
  if (!teacherRegistrationToken.value) return 'Loading...'
  const host = window.location.origin
  return `${host}/register-teacher?token=${teacherRegistrationToken.value}`
})
const usersList = ref([])
const userSearchQuery = ref('')

const showCreateUserModal = ref(false)
const createUserForm = ref({ name: '', username: '', email: '', role: 'student', password: '' })
const showEditUserModal = ref(false)
const editUserForm = ref({ id: '', name: '', username: '', email: '', role: 'student' })
const showChangePasswordModal = ref(false)
const selectedUserForPassword = ref(null)
const newUserPassword = ref('')
const savingUser = ref(false)

// Filter worksheets
const filteredWorksheets = computed(() => {
  let list = worksheets.value
  if (worksheetSearch.value.trim()) {
    const q = worksheetSearch.value.trim().toLowerCase()
    list = list.filter(ws => 
      (ws.title || '').toLowerCase().includes(q) ||
      (ws.subject || '').toLowerCase().includes(q)
    )
  }
  if (worksheetStatusFilter.value === 'published') list = list.filter(ws => ws.is_published)
  if (worksheetStatusFilter.value === 'draft') list = list.filter(ws => !ws.is_published)
  if (worksheetTagFilter.value.trim()) {
    const tagQ = worksheetTagFilter.value.trim().toLowerCase()
    list = list.filter(ws => (ws.tags || '').toLowerCase().includes(tagQ))
  }
  return list
})

// Filter users list by query
const filteredUsers = computed(() => {
  const query = userSearchQuery.value.trim().toLowerCase()
  if (!query) return usersList.value
  return usersList.value.filter(usr => {
    return (usr.name || '').toLowerCase().includes(query) ||
           (usr.username || '').toLowerCase().includes(query) ||
           (usr.email || '').toLowerCase().includes(query)
  })
})
const lowestPerformingSubject = computed(() => {
  const list = teacherAnalytics.value?.subjectPerformance
  return Array.isArray(list) && list.length > 0 ? list[0].subject : 'N/A'
})

const showAssignModal = ref(false)
const selectedSheet = ref(null)
const assignForm = ref({
  class_name: '',
  class_id: '',
  due_date: '',
  retry_policy: 'single',
  max_attempts: 2,
  peer_review_enabled: false,
  adaptive_difficulty: 'auto'
})

// State for Modals

const pdfInput = ref(null)

const triggerPdfUpload = () => {
  if (pdfInput.value) {
    pdfInput.value.click()
  }
}

const handlePdfUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  if (file.type !== 'application/pdf') {
    alert('Please upload a valid PDF file.')
    return
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const API_BASE = '/api'
    const token = localStorage.getItem('token')
    alert('Importing students from PDF... this might take a few seconds.')
    const res = await fetch(`${API_BASE}/classes/import-pdf`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    })
    
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to import PDF')
    
    alert(`Import complete!\n\nClasses Created: ${data.results.classesCreated}\nStudents Created: ${data.results.studentsCreated}\nClasses Already Existing: ${data.results.classesExisting}\nStudents Already Existing: ${data.results.studentsExisting}`)
    await fetchClasses()
  } catch (err) {
    console.error(err)
    alert('Error importing PDF: ' + err.message)
  } finally {
    event.target.value = ''
  }
}

const selectedAssignClass = ref(null)

const showResultsModal = ref(false)
const currentResults = ref([])

// Courses state
const courses = ref([])
const showCreateCourseModal = ref(false)
const newCourseForm = ref({ title: '', description: '' })
const selectedCourseDetail = ref(null)
const selectedWorksheetToAdd = ref('')
const showAssignCourseModal = ref(false)
const assignCourseForm = ref({ class_id: '', due_date: '' })
const selectedAssignCourseClass = ref(null)

// Classes & Groups state
const classes = ref([])
const showCreateClassModal = ref(false)
const newClassName = ref('')

const selectedClassId = ref(null)
const selectedClassDetail = ref(null)

const showAddStudentModal = ref(false)
const allStudents = ref([])
const studentSearchQuery = ref('')
const selectedStudentIds = ref([])

// Manual Student registration state
const showCreateStudentModal = ref(false)
const newStudentForm = ref({ name: '', email: '', role: 'student' })

// Templates state
const templates = ref([])
const templateSubjects = ['Englisch', 'Mathematik', 'Deutsch', 'Geographie', 'Biologie', 'Chemie', 'Physik']
const selectedTemplateSubject = ref('Englisch')

const filteredTemplates = computed(() => {
  return templates.value.filter(tpl => tpl.subject === selectedTemplateSubject.value)
})

const getSubjectIcon = (subject) => {
  const icons = {
    'Englisch': '🇬🇧',
    'Mathematik': '📐',
    'Deutsch': '📚',
    'Geographie': '🌍',
    'Biologie': '🧬',
    'Chemie': '🧪',
    'Physik': '⚛️'
  }
  return icons[subject] || '📝'
}


// Worksheet filter refs
const worksheetSearch = ref('')
const worksheetStatusFilter = ref('')
const worksheetTagFilter = ref('')

// Announcements state
const classAnnouncements = ref([])
const newAnnouncement = ref('')

// Stats modal state
const showStatsModal = ref(false)
const currentStats = ref(null)
const atRiskStudents = ref([])
const interventionGroups = ref([])
const teacherAnalytics = ref(null)

// CSV import state
const showImportCSVModal = ref(false)
const csvPreview = ref([])
const importingCSV = ref(false)

const API_BASE = '/api'

const fetchData = async () => {
  loading.value = true
  error.value = null
  const token = localStorage.getItem('token')
  try {
    // Determine current user
    currentUser.value = JSON.parse(localStorage.getItem('user') || 'null')

    // Worksheets
    const wsResp = await fetch(`${API_BASE}/worksheets`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    worksheets.value = await wsResp.json()

    // Assignments
    const assignList = []
    for (const ws of worksheets.value) {
      const aResp = await fetch(`${API_BASE}/worksheets/${ws.id}/assignments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await aResp.json()
      data.forEach(item => {
        assignList.push({
          ...item,
          worksheet_title: ws.title
        })
      })
    }
    assignments.value = assignList

    // Classes
    await fetchClasses()
    
    // Courses
    await fetchCourses()

    // Load admin settings/users if admin role
    if (currentUser.value && currentUser.value.role === 'admin') {
      await fetchAdminSettings()
      await fetchAdminUsers()
    }

    const [riskResp, groupResp, analyticsResp] = await Promise.all([
      fetch(`${API_BASE}/learning/teacher/at-risk`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_BASE}/learning/teacher/interventions`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_BASE}/learning/teacher/analytics`, { headers: { 'Authorization': `Bearer ${token}` } })
    ])
    if (riskResp.ok) atRiskStudents.value = await riskResp.json()
    if (groupResp.ok) interventionGroups.value = await groupResp.json()
    if (analyticsResp.ok) teacherAnalytics.value = await analyticsResp.json()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

// ─── Settings & User Management Actions ──────────────────────────────────────────
const fetchAdminSettings = async () => {
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/auth/settings`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      settingsForm.value = { auth_mode: data.auth_mode || 'local' }
      aiSettingsForm.value = { 
        gemini_api_key: data.gemini_api_key || '',
        gemini_model: data.gemini_model || 'gemini-2.5-flash',
        ollama_base_url: data.ollama_base_url || 'http://localhost:11434',
        ollama_model: data.ollama_model || 'llama3.1'
      }
    }
  } catch (err) {
    console.error('Failed to fetch settings:', err)
  }
}

const saveAiSettings = async () => {
  savingAiSettings.value = true
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/auth/settings`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(aiSettingsForm.value)
    })
    if (res.ok) alert('AI configurations saved successfully!')
    else alert('Failed to save AI configuration.')
  } catch (err) {
    alert('Error saving AI config: ' + err.message)
  } finally {
    savingAiSettings.value = false
  }
}

const fetchAdminUsers = async () => {
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/auth/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      usersList.value = await res.json()
    }
  } catch (err) {
    console.error('Failed to fetch users:', err)
  }
}

const fetchTeacherToken = async () => {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/auth/teacher-token`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      teacherRegistrationToken.value = data.token
    }
  } catch (err) {
    console.error('Failed to fetch teacher token', err)
  }
}

const generateNewTeacherToken = async () => {
  if (!confirm('Are you sure? This will invalidate the previous registration link.')) return
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/auth/teacher-token`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      teacherRegistrationToken.value = data.token
    }
  } catch (err) {
    console.error('Failed to regenerate teacher token', err)
  }
}

const copyTeacherLink = () => {
  navigator.clipboard.writeText(teacherRegistrationUrl.value)
  alert('Registration link copied to clipboard!')
}

const saveAuthSettings = async () => {
  savingSettings.value = true
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/auth/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(settingsForm.value)
    })
    if (!res.ok) throw new Error('Failed to save settings')
    alert('System settings saved successfully!')
  } catch (err) {
    alert(err.message)
  } finally {
    savingSettings.value = false
  }
}

const openCreateUserModal = () => {
  createUserForm.value = { name: '', username: '', email: '', role: 'student', password: '' }
  showCreateUserModal.value = true
}

const createUserAccount = async () => {
  savingUser.value = true
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(createUserForm.value)
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to create user')
    }
    showCreateUserModal.value = false
    alert('User registered successfully!')
    await fetchAdminUsers()
  } catch (err) {
    alert(err.message)
  } finally {
    savingUser.value = false
  }
}

const openEditUserModal = (usr) => {
  editUserForm.value = {
    id: usr.id,
    name: usr.name,
    username: usr.username || '',
    email: usr.email || '',
    role: usr.role
  }
  showEditUserModal.value = true
}

const updateUserAccount = async () => {
  savingUser.value = true
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/auth/users/${editUserForm.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(editUserForm.value)
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to update user')
    }
    showEditUserModal.value = false
    alert('User profile updated!')
    await fetchAdminUsers()
  } catch (err) {
    alert(err.message)
  } finally {
    savingUser.value = false
  }
}

const openChangePasswordModal = (usr) => {
  selectedUserForPassword.value = usr
  newUserPassword.value = ''
  showChangePasswordModal.value = true
}

const changeUserPassword = async () => {
  savingUser.value = true
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/auth/users/${selectedUserForPassword.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ password: newUserPassword.value })
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to change password')
    }
    showChangePasswordModal.value = false
    alert('Password updated successfully!')
  } catch (err) {
    alert(err.message)
  } finally {
    savingUser.value = false
  }
}

const deleteUserAccount = async (usr) => {
  if (!confirm(`Are you sure you want to permanently delete the account of ${usr.name}?`)) return
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/auth/users/${usr.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to delete user account')
    alert('User account deleted!')
    await fetchAdminUsers()
  } catch (err) {
    alert(err.message)
  }
}

onMounted(fetchData)

// Roster computed filter
const filteredStudents = computed(() => {
  const query = studentSearchQuery.value.toLowerCase().trim()
  const enrolledIds = selectedClassDetail.value ? selectedClassDetail.value.matrix.map(m => m.student_id) : []
  return allStudents.value.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(query) || s.email.toLowerCase().includes(query)
    const notEnrolled = !enrolledIds.includes(s.id)
    return matchesSearch && notEnrolled
  })
})

const switchTab = async (tab) => {
  activeTab.value = tab
  if (tab === 'classes') {
    await fetchClasses()
  } else if (tab === 'templates') {
    await fetchTemplates()
  }
}

// ─── Classes API Actions ──────────────────────────────────────────────────────
const fetchClasses = async () => {
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/classes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    classes.value = await res.json()
  } catch (err) {
    console.error('Failed to fetch classes:', err)
  }
}

const selectClass = async (classId) => {
  selectedClassId.value = classId
  await fetchClassDetail(classId)
}

const fetchClassDetail = async (classId) => {
  loading.value = true
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/classes/${classId}/progress`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    selectedClassDetail.value = await res.json()
    await fetchAnnouncements(classId)
  } catch (err) {
    alert('Failed to load class details: ' + err.message)
  } finally {
    loading.value = false
  }
}

const createClass = async () => {
  if (!newClassName.value.trim()) return
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: newClassName.value })
    })
    if (!res.ok) throw new Error('Failed to create class')
    newClassName.value = ''
    showCreateClassModal.value = false
    await fetchClasses()
  } catch (err) {
    alert(err.message)
  }
}

const deleteClass = async (classId) => {
  if (!confirm('Are you sure you want to delete this class? This will not delete assignments, but enrollment associations will be lost.')) return
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/classes/${classId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to delete class')
    if (selectedClassId.value === classId) {
      selectedClassId.value = null
      selectedClassDetail.value = null
    }
    await fetchClasses()
  } catch (err) {
    alert(err.message)
  }
}

// ─── COURSES LOGIC ──────────────────────────────────────────────────────────

const fetchCourses = async () => {
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/courses`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) courses.value = await res.json()
  } catch (err) {
    console.error('Failed to fetch courses:', err)
  }
}

const createCourse = async () => {
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(newCourseForm.value)
    })
    if (!res.ok) throw new Error('Failed to create course')
    showCreateCourseModal.value = false
    newCourseForm.value = { title: '', description: '' }
    await fetchCourses()
  } catch (err) {
    alert(err.message)
  }
}

const selectCourse = async (course) => {
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/courses/${course.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to load course details')
    selectedCourseDetail.value = await res.json()
    activeTab.value = 'course-detail'
  } catch (err) {
    alert(err.message)
  }
}

const deleteCourse = async (id) => {
  if (!confirm('Are you sure you want to delete this course?')) return
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/courses/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) await fetchCourses()
  } catch (err) {
    alert(err.message)
  }
}

const addWorksheetToCourse = async () => {
  if (!selectedWorksheetToAdd.value) return
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/courses/${selectedCourseDetail.value.id}/worksheets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ worksheet_id: selectedWorksheetToAdd.value })
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to add worksheet')
    }
    selectedWorksheetToAdd.value = ''
    await selectCourse(selectedCourseDetail.value)
    await fetchCourses() // update counts
  } catch (err) {
    alert(err.message)
  }
}

const removeWorksheetFromCourse = async (worksheetId) => {
  if (!confirm('Remove this worksheet from the course?')) return
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/courses/${selectedCourseDetail.value.id}/worksheets/${worksheetId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      await selectCourse(selectedCourseDetail.value)
      await fetchCourses()
    }
  } catch (err) {
    alert(err.message)
  }
}

const openAssignCourseModal = (course) => {
  assignCourseForm.value = { class_id: '', due_date: '' }
  selectedAssignCourseClass.value = null
  showAssignCourseModal.value = true
}

const selectAssignCourseClass = (cls) => {
  selectedAssignCourseClass.value = cls
  assignCourseForm.value.class_id = cls.id
}

const assignCourseToClass = async () => {
  if (!assignCourseForm.value.class_id) return alert('Select a class first')
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/courses/${selectedCourseDetail.value.id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(assignCourseForm.value)
    })
    if (!res.ok) throw new Error('Failed to assign course')
    showAssignCourseModal.value = false
    alert('Course assigned successfully!')
  } catch (err) {
    alert(err.message)
  }
}

// ─── UTILS ────────────────────────────────────────────────────────────────
const openAddStudentModal = async () => {
  studentSearchQuery.value = ''
  selectedStudentIds.value = []
  showAddStudentModal.value = true
  
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/classes/students/all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    allStudents.value = await res.json()
  } catch (err) {
    console.error('Failed to load students:', err)
  }
}

const addStudents = async () => {
  if (selectedStudentIds.value.length === 0) return
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/classes/${selectedClassId.value}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ studentIds: selectedStudentIds.value })
    })
    if (!res.ok) throw new Error('Failed to enroll students')
    showAddStudentModal.value = false
    await fetchClassDetail(selectedClassId.value)
  } catch (err) {
    alert(err.message)
  }
}

const removeStudent = async (studentId) => {
  if (!confirm('Are you sure you want to remove this pupil from the class roster?')) return
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/classes/${selectedClassId.value}/students/${studentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to remove student')
    await fetchClassDetail(selectedClassId.value)
  } catch (err) {
    alert(err.message)
  }
}

// ─── Manual Pupil Registration ────────────────────────────────────────────────
const openCreateStudentModal = () => {
  newStudentForm.value = { name: '', email: '', role: 'student' }
  showCreateStudentModal.value = true
}

const createStudent = async () => {
  if (!newStudentForm.value.name.trim() || !newStudentForm.value.email.trim()) return
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/classes/students/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...newStudentForm.value,
        class_id: selectedClassId.value
      })
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to register student')
    }
    showCreateStudentModal.value = false
    await fetchClassDetail(selectedClassId.value)
    alert('Student registered and enrolled successfully!')
  } catch (err) {
    alert(err.message)
  }
}

// ─── Matrix Math Helpers ───────────────────────────────────────────────────────
const calculateStudentCompletion = (row, assignments) => {
  if (assignments.length === 0) return 0
  let completed = 0
  assignments.forEach(assign => {
    if (row.submissions[assign.assignment_id]?.status === 'completed') {
      completed++
    }
  })
  return Math.round((completed / assignments.length) * 100)
}

const calculateClassAverage = (matrix, assignmentId) => {
  if (matrix.length === 0) return 0
  let sum = 0
  let count = 0
  matrix.forEach(row => {
    const sub = row.submissions[assignmentId]
    if (sub && sub.status === 'completed') {
      const percent = (sub.score / sub.max_score) * 100
      sum += percent
      count++
    }
  })
  return count > 0 ? Math.round(sum / count) : 0
}

const calculateClassOverallCompletion = (matrix, assignments) => {
  if (matrix.length === 0 || assignments.length === 0) return 0
  let totalCells = matrix.length * assignments.length
  let completedCells = 0
  matrix.forEach(row => {
    assignments.forEach(assign => {
      if (row.submissions[assign.assignment_id]?.status === 'completed') {
        completedCells++
      }
    })
  })
  return Math.round((completedCells / totalCells) * 100)
}

// ─── Templates API Actions ─────────────────────────────────────────────────────
const fetchTemplates = async () => {
  loading.value = true
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/worksheets/templates`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn('Failed to load templates:', err.error || res.statusText)
      templates.value = []
      return
    }
    const data = await res.json()
    templates.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Failed to load templates:', err)
    templates.value = []
  } finally {
    loading.value = false
  }
}

const useTemplate = async (templateId) => {
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/worksheets/templates/${templateId}/clone`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to clone template')
    alert('Template cloned successfully!')
    activeTab.value = 'worksheets'
    await fetchData()
  } catch (err) {
    alert(err.message)
  }
}

// ─── Assignment Setup Actions ──────────────────────────────────────────────────
const openAssignModal = (sheet) => {
  selectedSheet.value = sheet
  selectedAssignClass.value = null
  assignForm.value = {
    class_name: '',
    class_id: '',
    due_date: '',
    retry_policy: 'single',
    max_attempts: 2,
    peer_review_enabled: false,
    adaptive_difficulty: 'auto'
  }
  showAssignModal.value = true
}

const onAssignClassChange = () => {
  if (selectedAssignClass.value) {
    assignForm.value.class_name = selectedAssignClass.value.name
    assignForm.value.class_id = selectedAssignClass.value.id
  } else {
    assignForm.value.class_name = ''
    assignForm.value.class_id = ''
  }
}

const submitAssign = async () => {
  const token = localStorage.getItem('token')
  try {
    const resp = await fetch(`${API_BASE}/worksheets/${selectedSheet.value.id}/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(assignForm.value)
    })
    if (!resp.ok) throw new Error('Failed to create assignment')
    showAssignModal.value = false
    fetchData()
  } catch (err) {
    alert(err.message)
  }
}

const deleteWorksheet = async (id) => {
  if (!confirm('Are you sure you want to delete this worksheet?')) return
  const token = localStorage.getItem('token')
  try {
    await fetch(`${API_BASE}/worksheets/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    fetchData()
  } catch (err) {
    alert(err.message)
  }
}

const createTeamsAssignment = async (assignId) => {
  const token = localStorage.getItem('token')
  try {
    const resp = await fetch(`${API_BASE}/teams/assignment/${assignId}/create-teams`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!resp.ok) {
      const data = await resp.json()
      throw new Error(data.error || 'Failed to create Teams assignment')
    }
    alert('Assignment successfully linked and published in Teams!')
    fetchData()
  } catch (err) {
    alert(err.message)
  }
}

const syncGrades = async (assignId) => {
  const token = localStorage.getItem('token')
  try {
    const resp = await fetch(`${API_BASE}/teams/assignment/${assignId}/push-grades`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await resp.json()
    alert(`Grade Sync Complete! Synced: ${data.synced} grades successfully.`)
    fetchData()
  } catch (err) {
    alert(err.message)
  }
}

const viewResults = async (assignId) => {
  const token = localStorage.getItem('token')
  try {
    const resp = await fetch(`${API_BASE}/worksheets/assignments/${assignId}/results`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    currentResults.value = await resp.json()
    showResultsModal.value = true
  } catch (err) {
    alert(err.message)
  }
}

const viewSingleAnswers = (sub) => {
  alert(JSON.stringify(sub.answers, null, 2))
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleString()
}

// ─── Duplicate Worksheet ──────────────────────────────────────────────────────
const duplicateWorksheet = async (id) => {
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/worksheets/${id}/duplicate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to duplicate worksheet')
    await fetchData()
  } catch (err) {
    alert(err.message)
  }
}

// ─── Delete Assignment ────────────────────────────────────────────────────────
const deleteAssignmentItem = async (assignmentId, worksheetId) => {
  if (!confirm('Delete this assignment? Students will no longer see it.')) return
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/worksheets/${worksheetId}/assignments/${assignmentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to delete assignment')
    await fetchData()
  } catch (err) {
    alert(err.message)
  }
}

// ─── Copy Class Code ──────────────────────────────────────────────────────────
const copyClassCode = (classCode) => {
  navigator.clipboard.writeText(classCode).then(() => {
    alert('Class code copied to clipboard!')
  }).catch(() => {
    prompt('Copy this class code:', classCode)
  })
}

// ─── Export Class CSV ─────────────────────────────────────────────────────────
const exportClassCSV = async (classId) => {
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/classes/${classId}/export-csv`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to export CSV')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'class-progress.csv'
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    alert(err.message)
  }
}

// ─── Announcements ─────────────────────────────────────────────────────────────
const fetchAnnouncements = async (classId) => {
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/classes/${classId}/announcements`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) classAnnouncements.value = await res.json()
  } catch (err) {
    console.error('Failed to fetch announcements:', err)
  }
}

const postAnnouncement = async () => {
  if (!newAnnouncement.value.trim()) return
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/classes/${selectedClassId.value}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: newAnnouncement.value.trim() })
    })
    if (!res.ok) throw new Error('Failed to post announcement')
    newAnnouncement.value = ''
    await fetchAnnouncements(selectedClassId.value)
  } catch (err) {
    alert(err.message)
  }
}

const deleteAnnouncement = async (annId) => {
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`${API_BASE}/classes/${selectedClassId.value}/announcements/${annId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) await fetchAnnouncements(selectedClassId.value)
  } catch (err) {
    alert(err.message)
  }
}

// ─── Assignment Stats ─────────────────────────────────────────────────────────
const fetchAssignmentStats = async (assignmentId) => {
  const token = localStorage.getItem('token')
  currentStats.value = null
  showStatsModal.value = true
  try {
    const res = await fetch(`${API_BASE}/worksheets/assignments/${assignmentId}/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) currentStats.value = await res.json()
  } catch (err) {
    alert(err.message)
    showStatsModal.value = false
  }
}

// ─── Teacher Feedback ─────────────────────────────────────────────────────────
const saveFeedback = async (submissionId, feedbackText) => {
  const token = localStorage.getItem('token')
  try {
    await fetch(`${API_BASE}/submissions/${submissionId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ feedback_text: feedbackText })
    })
  } catch (err) {
    console.error('Failed to save feedback:', err)
  }
}

// ─── CSV Import ───────────────────────────────────────────────────────────────
const handleCSVUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    const lines = e.target.result.split('\n').filter(l => l.trim())
    if (lines.length < 2) { alert('CSV must have a header row and at least one data row'); return }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
    const nameIdx = headers.findIndex(h => h === 'name')
    const emailIdx = headers.findIndex(h => h === 'email')
    if (nameIdx === -1 || emailIdx === -1) { alert('CSV must have "name" and "email" columns'); return }
    const usernameIdx = headers.findIndex(h => h === 'username')
    const passwordIdx = headers.findIndex(h => h === 'password')
    csvPreview.value = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      return {
        name: cols[nameIdx] || '',
        email: cols[emailIdx] || '',
        username: usernameIdx !== -1 ? cols[usernameIdx] : '',
        password: passwordIdx !== -1 ? cols[passwordIdx] : ''
      }
    }).filter(r => r.name && r.email)
  }
  reader.readAsText(file)
}

const importCSVStudents = async () => {
  if (csvPreview.value.length === 0) return
  importingCSV.value = true
  const token = localStorage.getItem('token')
  let successCount = 0
  let errors = []
  for (const student of csvPreview.value) {
    try {
      const res = await fetch(`${API_BASE}/classes/students/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...student, class_id: selectedClassId.value })
      })
      if (res.ok) successCount++
      else {
        const data = await res.json()
        errors.push(`${student.name}: ${data.error}`)
      }
    } catch (err) {
      errors.push(`${student.name}: ${err.message}`)
    }
  }
  importingCSV.value = false
  showImportCSVModal.value = false
  csvPreview.value = []
  let msg = `Import complete! ${successCount} students imported.`
  if (errors.length > 0) msg += `\n\nErrors:\n${errors.slice(0, 5).join('\n')}`
  alert(msg)
  if (selectedClassId.value) await fetchClassDetail(selectedClassId.value)
}
</script>
<style scoped>
.teacher-dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.tag-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  background: var(--primary-light);
  color: var(--primary);
  padding: 2px 6px;
  border-radius: 12px;
  margin-right: 4px;
  margin-bottom: 2px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.dashboard-header h1 {
  font-size: 28px;
  font-weight: 800;
}

.dashboard-header h1 span {
  color: var(--primary);
}

.subtitle {
  color: var(--text-muted);
}

.insight-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}

.insight-card {
  padding: 14px;
}

.insight-card h3 {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.insight-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--primary);
}

.tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 8px;
}

.tab-btn {
  background: none;
  border: none;
  box-shadow: none;
  min-height: auto;
  font-size: 16px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.tab-btn.active {
  color: var(--primary);
  background-color: var(--primary-light);
  font-weight: 700;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.data-table th, .data-table td {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.data-table th {
  font-weight: 700;
  color: var(--text-muted);
  font-size: 13px;
  text-transform: uppercase;
}

.font-bold {
  font-weight: 600;
}

.badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 20px;
}

.badge-success {
  background-color: var(--success-light);
  color: var(--success);
}

.badge-warning {
  background-color: var(--warning-light);
  color: var(--warning);
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn-icon {
  background: none;
  border: 1px solid var(--border-color);
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: auto;
  box-shadow: none;
}

.btn-icon:hover {
  background-color: var(--primary-light);
  border-color: var(--primary);
}

.btn-icon-danger:hover {
  background-color: var(--danger-light);
  border-color: var(--danger);
}

.assignments-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.assignment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.assignment-info h3 {
  font-size: 18px;
  margin-bottom: 6px;
}

.assignment-info p {
  font-size: 14px;
  color: var(--text-muted);
}

.share-code {
  background-color: var(--primary-light);
  color: var(--primary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: 700;
}

.assignment-stats {
  display: flex;
  align-items: center;
  gap: 32px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 24px;
  font-weight: 800;
  color: var(--primary);
}

.stat-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 700;
}

.stat-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-sm {
  font-size: 12px;
  padding: 6px 12px;
  min-height: auto;
}

/* Modal styling */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal {
  width: 100%;
  max-width: 500px;
  animation: modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-lg {
  max-width: 800px;
}

@keyframes modalIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 20px;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  min-height: auto;
  box-shadow: none;
}

/* Templates Tab Styling */
.templates-overview {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.subject-tabs-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 24px 0;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(8px);
}

.subject-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.subject-tab-btn {
  flex: 1;
  min-width: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  padding: 12px 18px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-sm);
  font-size: 15px;
  font-weight: 600;
}

.subject-tab-btn:hover {
  transform: translateY(-2px);
  border-color: var(--primary);
  background-color: var(--primary-light);
  color: var(--primary);
}

.subject-tab-btn.active {
  background: linear-gradient(135deg, var(--primary), hsl(var(--primary-hue), 85%, 65%));
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
}

.subject-icon {
  font-size: 18px;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-top: 24px;
}

.template-card {
  display: flex;
  flex-direction: column;
  padding: 24px;
  height: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.template-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-premium);
  border-color: var(--primary);
}

.template-tag {
  align-self: flex-start;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--primary-light);
  color: var(--primary);
  padding: 4px 10px;
  border-radius: 20px;
  margin-bottom: 16px;
  transition: all 0.3s ease;
}

.template-card:hover .template-tag {
  background: var(--primary);
  color: white;
}

.template-card h3 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--text-main);
}

.template-desc {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 20px;
  flex-grow: 1;
}

.template-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
  margin-bottom: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-template-action {
  width: 100%;
  justify-content: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  text-align: center;
  margin-top: 24px;
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-lg);
  background: transparent;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.8;
}

.empty-state h3 {
  font-size: 20px;
  margin-bottom: 8px;
  color: var(--text-main);
}

.empty-state p {
  color: var(--text-muted);
  max-width: 400px;
}
</style>
