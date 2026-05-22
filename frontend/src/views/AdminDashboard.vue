<template>
  <div class="admin-dashboard-container">
    <!-- Header -->
    <header class="dashboard-header card glass fade-in">
      <div class="header-info">
        <h1>
          System Administration Panel
          <span class="badge badge-admin">Admin</span>
        </h1>
        <p class="subtitle">Manage AI providers, configure integrations, administer users, browse class matrices, and parse student lists.</p>
      </div>
      <div class="header-actions">
        <router-link to="/teacher" class="btn btn-secondary">
          <span>👨‍🏫 Teacher Console</span>
        </router-link>
      </div>
    </header>

    <!-- Role Information Banner -->
    <div class="role-info-banner card glass fade-in">
      <div class="role-info-trigger" @click="showRoleHelp = !showRoleHelp">
        <span class="info-badge">ℹ️</span>
        <span class="info-title">Need help with User Roles & Permissions? Click here to learn about Students, Teachers, and Admins.</span>
        <span class="chevron">{{ showRoleHelp ? '▲' : '▼' }}</span>
      </div>
      <transition name="slide-fade">
        <div v-if="showRoleHelp" class="role-info-content">
          <div class="role-card student">
            <h4>🎓 Student (Schüler)</h4>
            <p>Access worksheet players, review completed homework scores, join classes using 6-character registration codes, and interact with the gamified learning modules.</p>
          </div>
          <div class="role-card teacher">
            <h4>👨‍🏫 Teacher (Lehrperson)</h4>
            <p>Design custom/AI-generated worksheets, create and manage student classes, assign coursework, grade student submissions, and send class-wide announcements.</p>
          </div>
          <div class="role-card admin">
            <h4>⚙️ Administrator (Admin)</h4>
            <p>Global system management. Configures Gemini & Ollama credentials, edits/removes user accounts, overrides any password, supervises all classes, and performs PDF school roster imports.</p>
          </div>
        </div>
      </transition>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs-nav card glass fade-in">
      <button @click="activeTab = 'settings'" class="tab-btn" :class="{ active: activeTab === 'settings' }">
        <span>⚙️ AI & System Settings</span>
      </button>
      <button @click="activeTab = 'users'" class="tab-btn" :class="{ active: activeTab === 'users' }">
        <span>👥 User Accounts</span>
      </button>
      <button @click="activeTab = 'classes'" class="tab-btn" :class="{ active: activeTab === 'classes' }">
        <span>🏫 Class Directory</span>
      </button>
      <button @click="activeTab = 'import'" class="tab-btn" :class="{ active: activeTab === 'import' }">
        <span>📄 PDF student list import</span>
      </button>
    </div>

    <!-- TAB CONTENT: System Settings -->
    <div v-if="activeTab === 'settings'" class="tab-content fade-in">
      <div class="grid-2col">
        <!-- Settings Form -->
        <div class="card glass settings-form-card">
          <h2>System Settings</h2>
          <p class="card-desc">Configure LLM integrations and default system-wide login credentials. Updates write directly to SQLite and server configurations.</p>
          
          <form @submit.prevent="saveSettings" class="admin-form">
            <div class="section-title">Google Gemini Integration</div>
            <div class="form-group">
              <label for="gemini-key">Gemini API Key</label>
              <input type="password" id="gemini-key" v-model="settingsForm.gemini_api_key" placeholder="Enter your Google Gemini API key" />
              <small class="form-help">Provide your Gemini API key to enable premium AI worksheet creation.</small>
            </div>
            <div class="form-group">
              <label for="gemini-model">Gemini Model</label>
              <input type="text" id="gemini-model" v-model="settingsForm.gemini_model" placeholder="gemini-2.5-flash" />
            </div>

            <div class="section-title">Ollama Local LLM (Fallback/Offline)</div>
            <div class="form-group">
              <label for="ollama-url">Ollama Base URL</label>
              <input type="text" id="ollama-url" v-model="settingsForm.ollama_base_url" placeholder="http://localhost:11434" />
            </div>
            <div class="form-group">
              <label for="ollama-model">Ollama Model</label>
              <input type="text" id="ollama-model" v-model="settingsForm.ollama_model" placeholder="llama3.1" />
            </div>

            <div class="section-title">Security & Authentications</div>
            <div class="form-group">
              <label for="auth-mode">Authentication Mode</label>
              <select id="auth-mode" v-model="settingsForm.auth_mode">
                <option value="local">Local Credentials (SQLite)</option>
                <option value="microsoft">Microsoft Entra ID (Federated)</option>
              </select>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" :disabled="savingSettings">
                <span>{{ savingSettings ? 'Saving Settings...' : 'Save Configuration 💾' }}</span>
              </button>
            </div>
          </form>
        </div>

        <!-- Teacher self-registration URL Card -->
        <div class="card glass token-card">
          <h2>Teacher Registration Link</h2>
          <p class="card-desc">Generate a secure signup token link for educators. Teachers registering with this link will automatically receive the `teacher` role.</p>

          <div class="token-container card">
            <label class="token-label">Teacher Enrollment URL</label>
            <div class="token-url-box">
              <input type="text" readonly :value="teacherRegistrationUrl" class="readonly-input" />
              <button @click="copyTokenLink" class="btn btn-secondary btn-sm" title="Copy Link to Clipboard">📋 Copy</button>
            </div>
            <p class="info-text">Distribute this link to teachers. When they load it, they can define their credentials and gain educator permissions instantly.</p>
          </div>

          <div class="token-actions">
            <button @click="regenerateToken" class="btn btn-danger btn-sm" :disabled="regeneratingToken">
              <span>🔄 Invalidate & Regenerate Token</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB CONTENT: User Accounts CRUD -->
    <div v-if="activeTab === 'users'" class="tab-content fade-in">
      <div class="card glass users-list-card">
        <div class="users-header">
          <div>
            <h2>User Accounts</h2>
            <p class="card-desc">Create, modify, and delete user profiles, reset default passwords, and re-assign school access roles.</p>
          </div>
          <button @click="openCreateUserModal" class="btn btn-primary btn-sm">
            <span>➕ Add User</span>
          </button>
        </div>

        <!-- Search and Filter Roster -->
        <div class="filter-bar">
          <input type="text" v-model="userSearchQuery" placeholder="Search by name, email, or username..." class="search-input" />
          <select v-model="userRoleFilter" class="role-select">
            <option value="">All Roles</option>
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
            <option value="admin">Administrators</option>
          </select>
        </div>

        <!-- Roster Grid Table -->
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Username</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>Last Active</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in filteredUsers" :key="u.id" class="user-row">
                <td class="font-bold">{{ u.name }}</td>
                <td><code class="username-code">{{ u.username || 'n/a' }}</code></td>
                <td>{{ u.email || 'n/a' }}</td>
                <td>
                  <span class="badge" :class="roleBadgeClass(u.role)">{{ u.role }}</span>
                </td>
                <td class="timestamp">{{ formatTimestamp(u.last_login) }}</td>
                <td class="timestamp">{{ formatTimestamp(u.created_at) }}</td>
                <td>
                  <div class="action-buttons">
                    <button @click="openEditUserModal(u)" class="btn-icon" title="Edit Profile">✏️</button>
                    <button @click="openResetPasswordModal(u)" class="btn-icon" title="Reset Password">🔑</button>
                    <button @click="deleteUser(u)" class="btn-icon btn-icon-danger" title="Delete User">🗑️</button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredUsers.length === 0">
                <td colspan="7" class="text-center text-muted py-20">No matching user accounts found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB CONTENT: Class Directory -->
    <div v-if="activeTab === 'classes'" class="tab-content fade-in">
      <div class="grid-layout">
        <!-- Class list index -->
        <div class="card glass classes-sidebar">
          <div class="classes-sidebar-header">
            <h2>Classes Directory</h2>
            <button @click="openCreateClassModal" class="btn btn-primary btn-sm">➕ Create</button>
          </div>
          <p class="card-desc">Supervise all classes, check student enrollment, and access academic matrices.</p>

          <div class="classes-list">
            <div 
              v-for="c in classes" 
              :key="c.id" 
              class="class-list-item"
              :class="{ active: selectedClass?.id === c.id }"
              @click="selectClass(c)"
            >
              <div class="class-info">
                <h3>{{ c.name }}</h3>
                <p>Teacher: {{ c.teacher_name || 'Unassigned' }}</p>
              </div>
              <div class="class-meta">
                <span class="class-badge-code">{{ c.class_code }}</span>
                <span class="pupil-count">{{ c.student_count || 0 }} 👥</span>
              </div>
            </div>
            <div v-if="classes.length === 0" class="text-center text-muted py-20">
              No classes defined. Create one or run PDF Import.
            </div>
          </div>
        </div>

        <!-- Expanded Selected Class Details Panel -->
        <div class="class-detail-panel">
          <div v-if="selectedClass" class="card glass class-detail-card fade-in">
            <div class="detail-header">
              <div>
                <h2>{{ selectedClass.name }}</h2>
                <p class="teacher-info">Managed by {{ selectedClass.teacher_name || 'Unassigned' }} • Access Code: <strong class="class-badge-code">{{ selectedClass.class_code }}</strong></p>
              </div>
              <button @click="deleteClass(selectedClass)" class="btn btn-danger btn-sm">Disband Class</button>
            </div>

            <!-- Detail tabs -->
            <div class="detail-tabs">
              <button @click="activeClassSubTab = 'roster'" class="detail-tab-btn" :class="{ active: activeClassSubTab === 'roster' }">
                👥 Roster & Enrollment ({{ classStudents.length }})
              </button>
              <button @click="activeClassSubTab = 'matrix'" class="detail-tab-btn" :class="{ active: activeClassSubTab === 'matrix' }">
                📊 Submission Matrix
              </button>
              <button @click="activeClassSubTab = 'announcements'" class="detail-tab-btn" :class="{ active: activeClassSubTab === 'announcements' }">
                📢 Announcements ({{ classAnnouncements.length }})
              </button>
            </div>

            <!-- SUB TAB: Class Roster & Enrollment -->
            <div v-if="activeClassSubTab === 'roster'" class="sub-tab-content">
              <div class="enrollment-controls">
                <div class="search-and-enroll">
                  <label>Enroll Existing Student:</label>
                  <div class="input-with-button">
                    <select v-model="studentToEnrollId" class="select-student">
                      <option value="">-- Choose student --</option>
                      <option v-for="s in enrollableStudents" :key="s.id" :value="s.id">
                        {{ s.name }} ({{ s.username }})
                      </option>
                    </select>
                    <button @click="enrollStudent" class="btn btn-primary btn-sm" :disabled="!studentToEnrollId">Enroll</button>
                  </div>
                </div>
                <div class="quick-register-student">
                  <label>Quick Register New Student:</label>
                  <button @click="openQuickCreateStudentModal" class="btn btn-secondary btn-sm">➕ New Student Account</button>
                </div>
              </div>

              <!-- Students list -->
              <table class="data-table mt-16">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Username</th>
                    <th>Email Address</th>
                    <th class="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in classStudents" :key="s.id">
                    <td class="font-bold">{{ s.name }}</td>
                    <td><code class="username-code">{{ s.username || 'n/a' }}</code></td>
                    <td>{{ s.email || 'n/a' }}</td>
                    <td class="text-right">
                      <button @click="removeStudentFromClass(s.id)" class="btn-icon btn-icon-danger" title="Remove from Class">🗑️</button>
                    </td>
                  </tr>
                  <tr v-if="classStudents.length === 0">
                    <td colspan="4" class="text-center text-muted py-20">No students enrolled in this class.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- SUB TAB: Progress Matrix -->
            <div v-if="activeClassSubTab === 'matrix'" class="sub-tab-content">
              <p class="tab-desc">Roster grades and active worksheets assigned to this class.</p>
              
              <div v-if="classProgress" class="matrix-scroll-wrapper">
                <table class="data-table matrix-table">
                  <thead>
                    <tr>
                      <th class="sticky-col">Student Name</th>
                      <th v-for="a in classProgress.assignments" :key="a.assignment_id" class="assignment-header" :title="a.title">
                        <div class="asg-title">{{ a.title }}</div>
                        <div class="asg-points">{{ a.total_points }} pts</div>
                      </th>
                      <th v-if="classProgress.assignments.length === 0" class="text-muted">No Worksheets Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="student in classProgress.students" :key="student.id">
                      <td class="font-bold sticky-col">{{ student.name }}</td>
                      <td v-for="a in classProgress.assignments" :key="a.assignment_id" class="text-center">
                        <span v-if="student.submissions[a.assignment_id]" class="matrix-cell">
                          <span 
                            class="badge" 
                            :class="student.submissions[a.assignment_id].status === 'completed' ? 'badge-success' : 'badge-warning'"
                          >
                            {{ student.submissions[a.assignment_id].score }}/{{ student.submissions[a.assignment_id].max_score }}
                          </span>
                        </span>
                        <span v-else class="text-muted">—</span>
                      </td>
                      <td v-if="classProgress.assignments.length === 0" class="text-center text-muted">—</td>
                    </tr>
                    <tr v-if="classProgress.students.length === 0">
                      <td colspan="100" class="text-center text-muted py-20">Enroll students to view grades.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="text-center py-20">Loading matrix...</div>
            </div>

            <!-- SUB TAB: Announcements -->
            <div v-if="activeClassSubTab === 'announcements'" class="sub-tab-content">
              <div class="announcements-manager">
                <!-- Post Announcement -->
                <form @submit.prevent="postAnnouncement" class="announcement-form">
                  <div class="form-group">
                    <label>Publish Class Announcement</label>
                    <textarea v-model="newAnnouncementText" placeholder="Write announcement text..." required rows="2"></textarea>
                  </div>
                  <div class="form-actions">
                    <button type="submit" class="btn btn-primary btn-sm" :disabled="postingAnnouncement">Publish Announcement</button>
                  </div>
                </form>

                <!-- List Announcements -->
                <div class="announcements-list mt-24">
                  <div v-for="a in classAnnouncements" :key="a.id" class="announcement-item card">
                    <div class="announcement-body">
                      <p>{{ a.message }}</p>
                      <small class="text-muted">Published by Admin • {{ formatTimestamp(a.created_at) }}</small>
                    </div>
                    <button @click="deleteAnnouncement(a.id)" class="btn-icon btn-icon-danger" title="Delete Announcement">🗑️</button>
                  </div>
                  <div v-if="classAnnouncements.length === 0" class="text-muted text-center py-12">
                    No announcements published to this class yet.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Placeholder if no class is selected -->
          <div v-else class="card glass class-detail-placeholder text-center py-40">
            <span style="font-size: 48px;">🏫</span>
            <h3>No Class Selected</h3>
            <p class="text-muted">Select a class from the directory roster index to examine roster enrollments, announcements, or grades.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB CONTENT: PDF Student List Import -->
    <div v-if="activeTab === 'import'" class="tab-content fade-in">
      <div class="card glass pdf-import-card">
        <h2>School Pupil List PDF Importer</h2>
        <p class="card-desc">Batch upload and parse official class rosters (e.g. `Schülerliste.pdf`). Standard class groups and individual pupil accounts will automatically be generated in one click.</p>

        <!-- Dropzone picker -->
        <div 
          class="pdf-dropzone" 
          :class="{ active: isDragOver, uploading: isImporting }"
          @dragover.prevent="isDragOver = true"
          @dragleave="isDragOver = false"
          @drop.prevent="handlePDFDrop"
          @click="$refs.pdfInput.click()"
        >
          <input 
            type="file" 
            ref="pdfInput" 
            style="display: none;" 
            accept=".pdf" 
            @change="handlePDFSelected" 
          />
          <div class="dropzone-content">
            <span class="icon">📄</span>
            <p v-if="!selectedPDFFile">Drag and drop your <strong>Schülerliste.pdf</strong> file here, or click to browse</p>
            <p v-else>Selected File: <strong>{{ selectedPDFFile.name }}</strong></p>
            <small class="text-muted">Supports raw PDF text extraction formatting</small>
          </div>
        </div>

        <div v-if="selectedPDFFile" class="import-actions mt-16 text-right">
          <button @click="clearPDFSelection" class="btn btn-secondary btn-sm" :disabled="isImporting">Cancel</button>
          <button @click="uploadAndParsePDF" class="btn btn-primary" :disabled="isImporting">
            <span>{{ isImporting ? 'Parsing PDF...' : 'Start Roster Import' }}</span>
          </button>
        </div>

        <!-- Import progress logs & output -->
        <div v-if="importResults || importError" class="import-results mt-24">
          <div v-if="importError" class="alert alert-danger">
            <strong>Import Mismatch/Error:</strong> {{ importError }}
          </div>
          <div v-else-if="importResults" class="success-report card">
            <h3>Import Roster Report</h3>
            <div class="stats-grid">
              <div class="stat-card">
                <span class="stat-value">{{ importResults.results.classesCreated }}</span>
                <span class="stat-label">Classes Created</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">{{ importResults.results.studentsCreated }}</span>
                <span class="stat-label">Students Created</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">{{ importResults.results.classesExisting }}</span>
                <span class="stat-label">Existing Classes Linked</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">{{ importResults.results.studentsExisting }}</span>
                <span class="stat-label">Existing Students Enrolled</span>
              </div>
            </div>

            <!-- Details Roster Log list -->
            <div class="import-log-box mt-16">
              <h4>Parsed Class and Pupil Rosters:</h4>
              <div class="class-summary-log" v-for="c in importResults.data" :key="c.name">
                <div class="summary-header">
                  <strong>Klasse: {{ c.name }}</strong> ({{ c.students.length }} Students)
                </div>
                <div class="summary-student-names">
                  <span v-for="name in c.students" :key="name" class="student-name-tag">{{ name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODALS -->
    <!-- Create User Modal -->
    <div v-if="showCreateUserModal" class="modal-overlay" @click.self="closeCreateUserModal">
      <div class="modal card glass">
        <div class="modal-header">
          <h3>Create User Profile</h3>
          <button @click="closeCreateUserModal" class="btn-close">&times;</button>
        </div>
        <form @submit.prevent="submitCreateUser" class="modal-form">
          <div class="form-group">
            <label for="u-name">Full Name</label>
            <input type="text" id="u-name" v-model="userForm.name" required placeholder="e.g. Maria Schmidt" />
          </div>
          <div class="form-group">
            <label for="u-email">Email Address</label>
            <input type="email" id="u-email" v-model="userForm.email" placeholder="e.g. maria.schmidt@school.com" />
          </div>
          <div class="form-group">
            <label for="u-username">Username (Optional)</label>
            <input type="text" id="u-username" v-model="userForm.username" placeholder="e.g. maria.schmidt" />
          </div>
          <div class="form-group">
            <label for="u-role">Role</label>
            <select id="u-role" v-model="userForm.role">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div class="form-group">
            <label for="u-password">Default Password</label>
            <input type="password" id="u-password" v-model="userForm.password" placeholder="Default: learnflow123" />
          </div>
          <div class="modal-buttons">
            <button type="button" @click="closeCreateUserModal" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="submittingUser">Create Account</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div v-if="showEditUserModal" class="modal-overlay" @click.self="closeEditUserModal">
      <div class="modal card glass">
        <div class="modal-header">
          <h3>Edit User Profile</h3>
          <button @click="closeEditUserModal" class="btn-close">&times;</button>
        </div>
        <form @submit.prevent="submitEditUser" class="modal-form">
          <div class="form-group">
            <label for="eu-name">Full Name</label>
            <input type="text" id="eu-name" v-model="editUserForm.name" required />
          </div>
          <div class="form-group">
            <label for="eu-email">Email Address</label>
            <input type="email" id="eu-email" v-model="editUserForm.email" />
          </div>
          <div class="form-group">
            <label for="eu-username">Username</label>
            <input type="text" id="eu-username" v-model="editUserForm.username" />
          </div>
          <div class="form-group">
            <label for="eu-role">Role</label>
            <select id="eu-role" v-model="editUserForm.role">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div class="modal-buttons">
            <button type="button" @click="closeEditUserModal" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="submittingUser">Save Profile</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Reset Password Modal -->
    <div v-if="showResetPasswordModal" class="modal-overlay" @click.self="closeResetPasswordModal">
      <div class="modal card glass">
        <div class="modal-header">
          <h3>Reset Password</h3>
          <button @click="closeResetPasswordModal" class="btn-close">&times;</button>
        </div>
        <form @submit.prevent="submitResetPassword" class="modal-form">
          <p>Assign a new password for user <strong>{{ resetPassUser?.name }}</strong>.</p>
          <div class="form-group">
            <label for="rp-password">New Password</label>
            <input type="password" id="rp-password" v-model="resetPassForm.password" required placeholder="Min 6 characters" />
          </div>
          <div class="modal-buttons">
            <button type="button" @click="closeResetPasswordModal" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="submittingUser">Reset Password</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Create Class Modal -->
    <div v-if="showCreateClassModal" class="modal-overlay" @click.self="closeCreateClassModal">
      <div class="modal card glass">
        <div class="modal-header">
          <h3>Create Class</h3>
          <button @click="closeCreateClassModal" class="btn-close">&times;</button>
        </div>
        <form @submit.prevent="submitCreateClass" class="modal-form">
          <div class="form-group">
            <label for="cc-name">Class Name</label>
            <input type="text" id="cc-name" v-model="createClassForm.name" required placeholder="e.g. 1a Deutsch" />
          </div>
          <div class="modal-buttons">
            <button type="button" @click="closeCreateClassModal" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="creatingClass">Create Class</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Quick Create Student (enroll context) Modal -->
    <div v-if="showQuickCreateStudentModal" class="modal-overlay" @click.self="closeQuickCreateStudentModal">
      <div class="modal card glass">
        <div class="modal-header">
          <h3>Register Student Account</h3>
          <button @click="closeQuickCreateStudentModal" class="btn-close">&times;</button>
        </div>
        <form @submit.prevent="submitQuickCreateStudent" class="modal-form">
          <p>This creates a student account and enrolls them into <strong>{{ selectedClass?.name }}</strong> immediately.</p>
          <div class="form-group">
            <label for="q-name">Student Full Name</label>
            <input type="text" id="q-name" v-model="quickStudentForm.name" required placeholder="e.g. Linus Auer" />
          </div>
          <div class="form-group">
            <label for="q-username">Student Username (Optional)</label>
            <input type="text" id="q-username" v-model="quickStudentForm.username" placeholder="e.g. lauer" />
          </div>
          <div class="form-group">
            <label for="q-password">Default Password</label>
            <input type="password" id="q-password" v-model="quickStudentForm.password" placeholder="Default: learnflow123" />
          </div>
          <div class="modal-buttons">
            <button type="button" @click="closeQuickCreateStudentModal" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="creatingStudent">Create & Enroll</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useToast } from '../composables/useToast.js'

const { showToast } = useToast()

const activeTab = ref('settings')
const API_BASE = '/api'

// --- Roles info trigger
const showRoleHelp = ref(false)

// --- Settings Tab Refs
const settingsForm = ref({
  gemini_api_key: '',
  gemini_model: 'gemini-2.5-flash',
  ollama_base_url: 'http://localhost:11434',
  ollama_model: 'llama3.1',
  auth_mode: 'local'
})
const savingSettings = ref(false)
const teacherRegistrationToken = ref('')
const regeneratingToken = ref(false)

// --- Users Tab Refs
const users = ref([])
const userSearchQuery = ref('')
const userRoleFilter = ref('')
const showCreateUserModal = ref(false)
const showEditUserModal = ref(false)
const showResetPasswordModal = ref(false)
const submittingUser = ref(false)

const userForm = ref({
  name: '',
  email: '',
  username: '',
  role: 'student',
  password: ''
})

const editUserForm = ref({
  id: '',
  name: '',
  email: '',
  username: '',
  role: 'student'
})

const resetPassUser = ref(null)
const resetPassForm = ref({
  password: ''
})

// --- Class Directory Tab Refs
const classes = ref([])
const selectedClass = ref(null)
const activeClassSubTab = ref('roster')
const classStudents = ref([])
const classAnnouncements = ref([])
const classProgress = ref(null)
const allUsersList = ref([]) // For filtering enrollable students
const studentToEnrollId = ref('')

const showCreateClassModal = ref(false)
const creatingClass = ref(false)
const createClassForm = ref({ name: '' })

const showQuickCreateStudentModal = ref(false)
const creatingStudent = ref(false)
const quickStudentForm = ref({ name: '', username: '', password: '' })

const newAnnouncementText = ref('')
const postingAnnouncement = ref(false)

// --- PDF Import Tab Refs
const selectedPDFFile = ref(null)
const isDragOver = ref(false)
const isImporting = ref(false)
const importResults = ref(null)
const importError = ref('')

// ============================================================================
// Computed properties
// ============================================================================
const teacherRegistrationUrl = computed(() => {
  const host = window.location.origin
  if (!teacherRegistrationToken.value) return 'Generating enrollment URL...'
  return `${host}/register-teacher?token=${teacherRegistrationToken.value}`
})

const filteredUsers = computed(() => {
  return users.value.filter(u => {
    const q = userSearchQuery.value.trim().toLowerCase()
    const matchesSearch = !q || 
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    
    const matchesRole = !userRoleFilter.value || u.role === userRoleFilter.value
    return matchesSearch && matchesRole
  })
})

const enrollableStudents = computed(() => {
  // Students who are NOT already enrolled in the selected class
  return allUsersList.value.filter(u => {
    if (u.role !== 'student') return false
    return !classStudents.value.some(cs => cs.id === u.id)
  })
})

// ============================================================================
// Lifecycle Hooks
// ============================================================================
onMounted(async () => {
  await fetchSettings()
  await fetchTeacherToken()
  await fetchUsers()
  await fetchClasses()
})

// ============================================================================
// Settings actions
// ============================================================================
const fetchSettings = async () => {
  try {
    const res = await fetch(`${API_BASE}/auth/settings`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    if (res.ok) {
      const data = await res.json()
      if (data) {
        settingsForm.value = {
          gemini_api_key: data.gemini_api_key || '',
          gemini_model: data.gemini_model || 'gemini-2.5-flash',
          ollama_base_url: data.ollama_base_url || 'http://localhost:11434',
          ollama_model: data.ollama_model || 'llama3.1',
          auth_mode: data.auth_mode || 'local'
        }
      }
    }
  } catch (err) {
    showToast('Failed to fetch system settings', 'danger')
  }
}

const saveSettings = async () => {
  savingSettings.value = true
  try {
    const res = await fetch(`${API_BASE}/auth/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify(settingsForm.value)
    })
    if (res.ok) {
      showToast('System configuration saved successfully', 'success')
      await fetchSettings() // refresh settings values
    } else {
      const data = await res.json()
      showToast(data.error || 'Failed to save configuration settings', 'danger')
    }
  } catch (err) {
    showToast('Network error during settings sync', 'danger')
  } finally {
    savingSettings.value = false
  }
}

const fetchTeacherToken = async () => {
  try {
    const res = await fetch(`${API_BASE}/auth/teacher-token`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    if (res.ok) {
      const data = await res.json()
      teacherRegistrationToken.value = data.token
    }
  } catch (err) {
    console.error('Failed to load teacher registration token', err)
  }
}

const regenerateToken = async () => {
  if (!confirm('Generating a new roster link will invalidate the old link. Any teachers currently loading the old URL will get authorization errors. Do you wish to continue?')) return
  regeneratingToken.value = true
  try {
    const res = await fetch(`${API_BASE}/auth/teacher-token`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    if (res.ok) {
      const data = await res.json()
      teacherRegistrationToken.value = data.token
      showToast('Teacher token successfully regenerated', 'success')
    } else {
      showToast('Failed to regenerate teacher token', 'danger')
    }
  } catch (err) {
    showToast('Network error invalidating teacher token', 'danger')
  } finally {
    regeneratingToken.value = false
  }
}

const copyTokenLink = () => {
  navigator.clipboard.writeText(teacherRegistrationUrl.value)
  showToast('Roster enrollment link copied to clipboard!', 'success')
}

// ============================================================================
// Users CRUD actions
// ============================================================================
const fetchUsers = async () => {
  try {
    const res = await fetch(`${API_BASE}/auth/users`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    if (res.ok) {
      const data = await res.json()
      users.value = data
      allUsersList.value = data
    }
  } catch (err) {
    showToast('Failed to fetch users list', 'danger')
  }
}

const openCreateUserModal = () => {
  userForm.value = { name: '', email: '', username: '', role: 'student', password: '' }
  showCreateUserModal.value = true
}

const closeCreateUserModal = () => {
  showCreateUserModal.value = false
}

const submitCreateUser = async () => {
  submittingUser.value = true
  try {
    const payload = { ...userForm.value }
    if (!payload.password) payload.password = 'learnflow123'
    const res = await fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      showToast('User account successfully provisioned', 'success')
      closeCreateUserModal()
      await fetchUsers()
    } else {
      const data = await res.json()
      showToast(data.error || 'Failed to create user', 'danger')
    }
  } catch (err) {
    showToast('Network error creating user', 'danger')
  } finally {
    submittingUser.value = false
  }
}

const openEditUserModal = (u) => {
  editUserForm.value = {
    id: u.id,
    name: u.name,
    email: u.email || '',
    username: u.username || '',
    role: u.role
  }
  showEditUserModal.value = true
}

const closeEditUserModal = () => {
  showEditUserModal.value = false
}

const submitEditUser = async () => {
  submittingUser.value = true
  try {
    const res = await fetch(`${API_BASE}/auth/users/${editUserForm.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify(editUserForm.value)
    })
    if (res.ok) {
      showToast('Profile credentials updated successfully', 'success')
      closeEditUserModal()
      await fetchUsers()
      if (selectedClass.value) {
        await fetchClassStudents(selectedClass.value.id)
      }
    } else {
      const data = await res.json()
      showToast(data.error || 'Failed to update user profile', 'danger')
    }
  } catch (err) {
    showToast('Network error updating user', 'danger')
  } finally {
    submittingUser.value = false
  }
}

const openResetPasswordModal = (u) => {
  resetPassUser.value = u
  resetPassForm.value = { password: '' }
  showResetPasswordModal.value = true
}

const closeResetPasswordModal = () => {
  showResetPasswordModal.value = false
  resetPassUser.value = null
}

const submitResetPassword = async () => {
  if (resetPassForm.value.password.length < 6) {
    showToast('Password must be at least 6 characters', 'danger')
    return
  }
  submittingUser.value = true
  try {
    const res = await fetch(`${API_BASE}/auth/users/${resetPassUser.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({
        name: resetPassUser.value.name,
        password: resetPassForm.value.password
      })
    })
    if (res.ok) {
      showToast('User password override completed successfully', 'success')
      closeResetPasswordModal()
    } else {
      const data = await res.json()
      showToast(data.error || 'Failed to reset password', 'danger')
    }
  } catch (err) {
    showToast('Network error overrides password', 'danger')
  } finally {
    submittingUser.value = false
  }
}

const deleteUser = async (u) => {
  const current = JSON.parse(localStorage.getItem('user'))
  if (current && current.id === u.id) {
    showToast('Cannot delete your own active administrator account', 'danger')
    return
  }
  if (!confirm(`Are you absolutely sure you want to permanently delete user account ${u.name}? All their submissions and class records will be discarded.`)) return
  try {
    const res = await fetch(`${API_BASE}/auth/users/${u.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    if (res.ok) {
      showToast('User account successfully deleted', 'success')
      await fetchUsers()
      if (selectedClass.value) {
        await fetchClassStudents(selectedClass.value.id)
      }
    } else {
      const data = await res.json()
      showToast(data.error || 'Failed to delete user account', 'danger')
    }
  } catch (err) {
    showToast('Network error deleting user account', 'danger')
  }
}

// ============================================================================
// Class Directory actions
// ============================================================================
const fetchClasses = async () => {
  try {
    const res = await fetch(`${API_BASE}/classes`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    if (res.ok) {
      const data = await res.json()
      classes.value = data
    }
  } catch (err) {
    showToast('Failed to load system classes directory', 'danger')
  }
}

const selectClass = async (c) => {
  selectedClass.value = c
  await fetchClassStudents(c.id)
  await fetchClassAnnouncements(c.id)
  await fetchClassProgress(c.id)
}

const fetchClassStudents = async (classId) => {
  try {
    const res = await fetch(`${API_BASE}/classes/${classId}/students`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    if (res.ok) {
      const data = await res.json()
      classStudents.value = data
    }
  } catch (err) {
    console.error('Failed to load class student list', err)
  }
}

const fetchClassAnnouncements = async (classId) => {
  try {
    const res = await fetch(`${API_BASE}/classes/${classId}/announcements`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    if (res.ok) {
      const data = await res.json()
      classAnnouncements.value = data
    }
  } catch (err) {
    console.error('Failed to load announcements', err)
  }
}

const fetchClassProgress = async (classId) => {
  try {
    const res = await fetch(`${API_BASE}/classes/${classId}/progress`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    if (res.ok) {
      const data = await res.json()
      classProgress.value = data
    }
  } catch (err) {
    console.error('Failed to load grade progress matrix', err)
  }
}

const openCreateClassModal = () => {
  createClassForm.value = { name: '' }
  showCreateClassModal.value = true
}

const closeCreateClassModal = () => {
  showCreateClassModal.value = false
}

const submitCreateClass = async () => {
  creatingClass.value = true
  try {
    const res = await fetch(`${API_BASE}/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify(createClassForm.value)
    })
    if (res.ok) {
      showToast('Class created successfully', 'success')
      closeCreateClassModal()
      await fetchClasses()
    } else {
      const data = await res.json()
      showToast(data.error || 'Failed to create class', 'danger')
    }
  } catch (err) {
    showToast('Network error creating class', 'danger')
  } finally {
    creatingClass.value = false
  }
}

const deleteClass = async (c) => {
  if (!confirm(`Are you absolutely sure you want to disband class ${c.name}? This will remove all students and unassign all worksheets immediately.`)) return
  try {
    const res = await fetch(`${API_BASE}/classes/${c.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    if (res.ok) {
      showToast('Class successfully disbanded', 'success')
      selectedClass.value = null
      await fetchClasses()
    } else {
      const data = await res.json()
      showToast(data.error || 'Failed to delete class', 'danger')
    }
  } catch (err) {
    showToast('Network error deleting class', 'danger')
  }
}

const enrollStudent = async () => {
  if (!studentToEnrollId.value) return
  try {
    const res = await fetch(`${API_BASE}/classes/${selectedClass.value.id}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ studentIds: [studentToEnrollId.value] })
    })
    if (res.ok) {
      showToast('Student enrolled successfully', 'success')
      studentToEnrollId.value = ''
      await selectClass(selectedClass.value)
      await fetchClasses() // Refresh count
    } else {
      const data = await res.json()
      showToast(data.error || 'Failed to enroll student', 'danger')
    }
  } catch (err) {
    showToast('Network error during student enrollment', 'danger')
  }
}

const removeStudentFromClass = async (studentId) => {
  if (!confirm('Are you sure you want to remove this student from this class? This will delete their class-level submission logs.')) return
  try {
    const res = await fetch(`${API_BASE}/classes/${selectedClass.value.id}/students/${studentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    if (res.ok) {
      showToast('Student successfully removed from class', 'success')
      await selectClass(selectedClass.value)
      await fetchClasses() // Refresh count
    } else {
      const data = await res.json()
      showToast(data.error || 'Failed to remove student', 'danger')
    }
  } catch (err) {
    showToast('Network error removing student', 'danger')
  }
}

const openQuickCreateStudentModal = () => {
  quickStudentForm.value = { name: '', username: '', password: '' }
  showQuickCreateStudentModal.value = true
}

const closeQuickCreateStudentModal = () => {
  showQuickCreateStudentModal.value = false
}

const submitQuickCreateStudent = async () => {
  creatingStudent.value = true
  try {
    // 1. Create User
    const payload = {
      name: quickStudentForm.value.name,
      username: quickStudentForm.value.username || undefined,
      password: quickStudentForm.value.password || 'learnflow123',
      role: 'student'
    }
    const resUser = await fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify(payload)
    })
    
    if (!resUser.ok) {
      const data = await resUser.json()
      showToast(data.error || 'Failed to register student profile', 'danger')
      return
    }

    const newUser = await resUser.json()

    // 2. Enroll student in class
    const resEnroll = await fetch(`${API_BASE}/classes/${selectedClass.value.id}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ studentIds: [newUser.id] })
    })

    if (resEnroll.ok) {
      showToast('New student account registered and enrolled', 'success')
      closeQuickCreateStudentModal()
      await fetchUsers()
      await selectClass(selectedClass.value)
      await fetchClasses() // Refresh count
    } else {
      showToast('Student account was registered but enrollment failed', 'warning')
    }
  } catch (err) {
    showToast('Network error during quick enrollment process', 'danger')
  } finally {
    creatingStudent.value = false
  }
}

const postAnnouncement = async () => {
  if (!newAnnouncementText.value.trim()) return
  postingAnnouncement.value = true
  try {
    const res = await fetch(`${API_BASE}/classes/${selectedClass.value.id}/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ message: newAnnouncementText.value })
    })
    if (res.ok) {
      showToast('Announcement posted to students', 'success')
      newAnnouncementText.value = ''
      await fetchClassAnnouncements(selectedClass.value.id)
    } else {
      const data = await res.json()
      showToast(data.error || 'Failed to post announcement', 'danger')
    }
  } catch (err) {
    showToast('Network error posting announcement', 'danger')
  } finally {
    postingAnnouncement.value = false
  }
}

const deleteAnnouncement = async (announcementId) => {
  try {
    const res = await fetch(`${API_BASE}/classes/${selectedClass.value.id}/announcements/${announcementId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
    if (res.ok) {
      showToast('Announcement removed', 'success')
      await fetchClassAnnouncements(selectedClass.value.id)
    } else {
      showToast('Failed to delete announcement', 'danger')
    }
  } catch (err) {
    showToast('Network error deleting announcement', 'danger')
  }
}

// ============================================================================
// PDF Student List Import actions
// ============================================================================
const handlePDFSelected = (e) => {
  const files = e.target.files
  if (files && files.length > 0) {
    selectedPDFFile.value = files[0]
    importError.value = ''
    importResults.value = null
  }
}

const handlePDFDrop = (e) => {
  isDragOver.value = false
  const files = e.dataTransfer.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      selectedPDFFile.value = file
      importError.value = ''
      importResults.value = null
    } else {
      showToast('Only official PDF file documents are supported', 'danger')
    }
  }
}

const clearPDFSelection = () => {
  selectedPDFFile.value = null
  importResults.value = null
  importError.value = ''
}

const uploadAndParsePDF = async () => {
  if (!selectedPDFFile.value) return
  isImporting.value = true
  importError.value = ''
  importResults.value = null

  const formData = new FormData()
  formData.append('file', selectedPDFFile.value)

  try {
    const res = await fetch(`${API_BASE}/classes/import-pdf`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: formData
    })
    const data = await res.json()
    if (res.ok) {
      showToast('School pupil list import completed successfully!', 'success')
      importResults.value = data
      selectedPDFFile.value = null
      await fetchUsers()
      await fetchClasses()
    } else {
      importError.value = data.error || 'Failed to process PDF list.'
      showToast(importError.value, 'danger')
    }
  } catch (err) {
    importError.value = 'A network error occurred while uploading class lists.'
    showToast(importError.value, 'danger')
  } finally {
    isImporting.value = false
  }
}

// ============================================================================
// Utilities
// ============================================================================
const roleBadgeClass = (role) => {
  if (role === 'admin') return 'badge-admin'
  if (role === 'teacher') return 'badge-teacher'
  return 'badge-student'
}

const formatTimestamp = (dateStr) => {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Watch selectedClass to load sub-tab details when class swaps
watch(selectedClass, async (newVal) => {
  if (newVal) {
    await selectClass(newVal)
  }
})
</script>

<style scoped>
.admin-dashboard-container {
  max-width: 1280px;
  margin: 0 auto;
  padding-bottom: 60px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}

.subtitle {
  color: var(--text-muted);
  font-size: 15px;
  margin-top: 4px;
}

.badge-admin {
  background-color: var(--danger-light);
  color: var(--danger);
  font-size: 12px;
  margin-left: 8px;
  vertical-align: middle;
}

.badge-teacher {
  background-color: var(--primary-light);
  color: var(--primary);
}

.badge-student {
  background-color: var(--secondary-light);
  color: var(--secondary);
}

/* Role Help Banner */
.role-info-banner {
  padding: 16px;
  cursor: pointer;
}

.role-info-trigger {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.info-badge {
  font-size: 20px;
}

.info-title {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-main);
}

.chevron {
  font-size: 12px;
  color: var(--text-muted);
}

.role-info-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.role-card {
  padding: 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-main);
}

.role-card h4 {
  margin-bottom: 8px;
  font-size: 14px;
}

.role-card p {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.role-card.student {
  border-left: 4px solid var(--secondary);
}

.role-card.teacher {
  border-left: 4px solid var(--primary);
}

.role-card.admin {
  border-left: 4px solid var(--danger);
}

/* Tabs */
.tabs-nav {
  display: flex;
  gap: 12px;
  padding: 12px;
  overflow-x: auto;
}

.tab-btn {
  background: none;
  border: none;
  font-size: 15px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 10px 18px;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  min-height: auto;
  box-shadow: none;
  font-weight: 600;
}

.tab-btn:hover {
  color: var(--primary);
  background-color: var(--primary-light);
}

.tab-btn.active {
  color: var(--primary);
  background-color: var(--primary-light);
  font-weight: 700;
}

/* Tab Layouts */
.grid-2col {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 24px;
}

@media (max-width: 900px) {
  .grid-2col {
    grid-template-columns: 1fr;
  }
}

.card h2 {
  font-size: 20px;
  margin-bottom: 8px;
}

.card-desc {
  color: var(--text-muted);
  font-size: 14px;
  margin-bottom: 24px;
}

/* Forms */
.admin-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-weight: 700;
  font-size: 14px;
  text-transform: uppercase;
  color: var(--primary);
  letter-spacing: 0.05em;
  margin-top: 12px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 6px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-help {
  font-size: 11px;
  color: var(--text-muted);
}

.info-icon {
  cursor: help;
  font-size: 12px;
}

.form-actions {
  margin-top: 12px;
}

/* Tokens link card */
.token-container {
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  padding: 16px;
  margin-bottom: 20px;
}

.token-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 6px;
  display: block;
}

.token-url-box {
  display: flex;
  gap: 8px;
}

.readonly-input {
  flex: 1;
  font-family: monospace;
  font-size: 13px;
  background: var(--bg-card) !important;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  outline: none;
}

.info-text {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}

.token-actions {
  display: flex;
  justify-content: flex-end;
}

/* Users List Tab */
.users-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.search-input {
  flex: 1;
}

.role-select {
  width: 200px;
}

@media (max-width: 600px) {
  .filter-bar {
    flex-direction: column;
  }
  .role-select {
    width: 100%;
  }
}

.username-code {
  background: var(--primary-light);
  color: var(--primary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: 600;
}

.timestamp {
  font-size: 12px;
  color: var(--text-muted);
}

.text-center {
  text-align: center;
}

.py-20 {
  padding-top: 20px;
  padding-bottom: 20px;
}

.py-40 {
  padding-top: 40px;
  padding-bottom: 40px;
}

.py-12 {
  padding-top: 12px;
  padding-bottom: 12px;
}

.mt-16 {
  margin-top: 16px;
}

.mt-24 {
  margin-top: 24px;
}

/* Class Directory layout */
.grid-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  align-items: start;
}

@media (max-width: 900px) {
  .grid-layout {
    grid-template-columns: 1fr;
  }
}

.classes-sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.classes-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.class-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: var(--bg-card);
}

.class-list-item:hover {
  border-color: var(--primary);
  background-color: var(--primary-light);
  transform: translateX(4px);
}

.class-list-item.active {
  border-color: var(--primary);
  background-color: var(--primary-light);
  box-shadow: var(--shadow-sm);
}

.class-info h3 {
  font-size: 15px;
  color: var(--text-main);
  margin-bottom: 2px;
}

.class-info p {
  font-size: 12px;
  color: var(--text-muted);
}

.class-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.class-badge-code {
  background-color: var(--bg-main);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: 700;
  font-size: 11px;
}

.pupil-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
}

/* Class details panel */
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 16px;
  margin-bottom: 16px;
}

.teacher-info {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 2px;
}

.detail-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 10px;
  margin-bottom: 16px;
}

.detail-tab-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  min-height: auto;
  box-shadow: none;
}

.detail-tab-btn:hover {
  background-color: var(--bg-main);
  color: var(--text-main);
}

.detail-tab-btn.active {
  background-color: var(--primary-light);
  color: var(--primary);
  font-weight: 700;
}

/* Class roster sub-tab */
.enrollment-controls {
  background-color: var(--bg-main);
  border: 1px solid var(--border-color);
  padding: 16px;
  border-radius: var(--radius-md);
  display: flex;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.search-and-enroll, .quick-register-student {
  flex: 1;
  min-width: 250px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.search-and-enroll label, .quick-register-student label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

.input-with-button {
  display: flex;
  gap: 8px;
}

.select-student {
  flex: 1;
}

.text-right {
  text-align: right;
}

/* Submission Matrix Tab */
.tab-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.matrix-scroll-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.matrix-table {
  width: max-content;
  min-width: 100%;
}

.sticky-col {
  position: sticky;
  left: 0;
  background-color: var(--bg-card);
  z-index: 10;
  border-right: 2px solid var(--border-color);
}

.user-row:hover .sticky-col, tr:hover .sticky-col {
  background-color: var(--primary-light);
}

.assignment-header {
  text-align: center;
  min-width: 120px;
}

.asg-title {
  font-size: 12px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 140px;
}

.asg-points {
  font-size: 10px;
  color: var(--text-muted);
}

.matrix-cell {
  display: inline-block;
}

.text-center {
  text-align: center;
}

/* Announcements Manager */
.announcement-form {
  background-color: var(--bg-main);
  border: 1px solid var(--border-color);
  padding: 16px;
  border-radius: var(--radius-md);
}

.announcements-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.announcement-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  gap: 16px;
}

.announcement-body p {
  font-size: 14px;
  margin-bottom: 4px;
}

/* Class details placeholder */
.class-detail-placeholder h3 {
  font-size: 18px;
  margin-top: 12px;
}

.class-detail-placeholder p {
  font-size: 13px;
  max-width: 320px;
  margin: 4px auto 0;
}

/* PDF Student Import Tab */
.pdf-import-card {
  max-width: 700px;
  margin: 0 auto;
}

.pdf-dropzone {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-lg);
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: var(--bg-main);
  margin-top: 16px;
}

.pdf-dropzone:hover, .pdf-dropzone.active {
  border-color: var(--primary);
  background-color: var(--primary-light);
}

.pdf-dropzone.uploading {
  pointer-events: none;
  opacity: 0.6;
}

.dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.dropzone-content .icon {
  font-size: 40px;
}

.dropzone-content p {
  font-size: 14px;
}

.success-report h3 {
  font-size: 16px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
}

.stat-card {
  background-color: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--primary);
}

.stat-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-top: 2px;
}

.import-log-box {
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
}

.import-log-box h4 {
  font-size: 14px;
  margin-bottom: 10px;
}

.class-summary-log {
  background-color: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px;
  margin-bottom: 10px;
}

.summary-header {
  font-size: 13px;
  margin-bottom: 8px;
}

.summary-student-names {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.student-name-tag {
  background-color: var(--bg-card);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 10px;
}

.alert {
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
}

.alert-danger {
  background-color: var(--danger-light);
  color: var(--danger);
  border: 1px solid var(--danger);
}

/* Modals */
.modal-overlay {
  z-index: 2000;
}

.modal-header h3 {
  font-size: 18px;
}

.modal-form {
  margin-top: 12px;
}

/* Animations */
.fade-in {
  animation: fadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.slide-fade-enter-active, .slide-fade-leave-active {
  transition: all 0.3s ease-out;
}

.slide-fade-enter-from, .slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>
