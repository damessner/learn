<template>
  <div class="login-page">
    <div class="login-card glass">
      <div class="logo">
        <span class="logo-emoji">✨</span>
        <h1>Learn<span>Flow</span></h1>
        <p class="subtitle">Interactive Worksheet Platform</p>
      </div>

      <div v-if="error" class="error-banner">
        <span>⚠️</span> {{ error }}
      </div>

      <div class="login-options">
        <!-- Local Login Form (Default) -->
        <div v-if="authMode === 'local'" class="option-card local-login">
          <h2>Sign In</h2>
          <p>Sign in with your local account credentials.</p>
          <form @submit.prevent="loginLocal" class="local-form">
            <div class="form-group">
              <label for="username">Username or Email</label>
              <input 
                id="username"
                type="text" 
                v-model="localUsername" 
                placeholder="e.g. admin or student" 
                required 
              />
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input 
                id="password"
                type="password" 
                v-model="localPassword" 
                placeholder="Enter password" 
                required 
              />
            </div>
            <button type="submit" :disabled="loading" class="btn btn-primary btn-block">
              Sign In 🔑
            </button>
          </form>
        </div>

        <!-- Microsoft Teams Login -->
        <div v-else-if="authMode === 'microsoft'" class="option-card microsoft-login">
          <h2>Microsoft Teams Login</h2>
          <p>Sign in with your school Microsoft 365 account to access your assigned work.</p>
          <button @click="loginWithMicrosoft" :disabled="loading" class="btn btn-primary btn-block">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 23 23">
              <rect x="0" y="0" width="11" height="11" fill="#f35325"/>
              <rect x="12" y="0" width="11" height="11" fill="#81bc06"/>
              <rect x="0" y="12" width="11" height="11" fill="#05a6f0"/>
              <rect x="12" y="12" width="11" height="11" fill="#ffba08"/>
            </svg>
            Sign in with Microsoft
          </button>
        </div>

        <div class="divider">
          <span>OR JOIN INDIVIDUALLY</span>
        </div>

        <div class="option-card guest-login">
          <h2>Join with Assignment Code</h2>
          <p>No account? Enter your name and assignment code directly.</p>
          <form @submit.prevent="loginAsGuest" class="guest-form">
            <div class="form-group">
              <label for="studentName">Your Name</label>
              <input 
                id="studentName"
                type="text" 
                v-model="guestName" 
                placeholder="e.g. Marie Meier" 
                required 
              />
            </div>
            <div class="form-group">
              <label for="assignmentCode">Assignment Code</label>
              <input 
                id="assignmentCode"
                type="text" 
                v-model="guestCode" 
                placeholder="e.g. 5a1b-c3d4" 
                required 
              />
            </div>
            <button type="submit" :disabled="loading" class="btn btn-secondary btn-block">
              Start Assignment 🚀
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const error = ref(null)
const authMode = ref('local')
const localUsername = ref('')
const localPassword = ref('')
const guestName = ref('')
const guestCode = ref('')

const API_BASE = '/api'

const fetchConfig = async () => {
  try {
    const resp = await fetch(`${API_BASE}/auth/config`)
    if (resp.ok) {
      const contentType = resp.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await resp.json()
        authMode.value = data.authMode
      } else {
        console.warn('Config endpoint returned non-JSON response');
      }
    }
  } catch (err) {
    console.error('Failed to fetch auth configuration', err)
  }
}

onMounted(() => {
  fetchConfig()
})

const loginLocal = async () => {
  loading.value = true
  error.value = null
  try {
    const resp = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: localUsername.value,
        password: localPassword.value
      })
    })

    if (!resp.ok) {
      let errorMessage = 'Invalid username or password';
      const contentType = resp.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          const errData = await resp.json();
          errorMessage = errData.error || errorMessage;
        } catch (e) {
          // Ignore parse errors
        }
      } else {
        errorMessage = `Server error (${resp.status}). The backend might be unavailable.`;
      }
      throw new Error(errorMessage);
    }

    const data = await resp.json()
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))

    router.push(data.user.role === 'student' ? '/student' : '/teacher')
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const loginWithMicrosoft = async () => {
  loading.value = true
  error.value = null
  try {
    const mockMSData = {
      name: 'Test Student',
      email: 'student@school.local'
    }

    const promptName = prompt("Enter name to login with (Type 'Teacher' or 'Admin' to login as educator, or press Enter for 'Test Student'):")
    if (promptName) {
      mockMSData.name = promptName
      mockMSData.email = promptName.toLowerCase().replace(/\s+/g, '') + '@school.local'
    }

    const resp = await fetch(`${API_BASE}/auth/microsoft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fallbackName: mockMSData.name,
        fallbackEmail: mockMSData.email,
        name: mockMSData.name,
        email: mockMSData.email
      })
    })

    if (!resp.ok) throw new Error('Microsoft login server error')

    const data = await resp.json()
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))

    router.push(data.user.role === 'student' ? '/student' : '/teacher')
  } catch (err) {
    error.value = err.message || 'Authentication failed'
  } finally {
    loading.value = false
  }
}

const loginAsGuest = async () => {
  loading.value = true
  error.value = null
  try {
    const resp = await fetch(`${API_BASE}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: guestName.value,
        classCode: guestCode.value
      })
    })

    if (!resp.ok) {
      let errorMessage = 'Failed to join assignment';
      const contentType = resp.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          const errData = await resp.json();
          errorMessage = errData.error || errorMessage;
        } catch (e) {
          // Ignore parse errors
        }
      } else {
        errorMessage = `Server error (${resp.status}). The backend might be unavailable.`;
      }
      throw new Error(errorMessage);
    }

    const data = await resp.json()
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))

    router.push(`/student/assignment/${guestCode.value}`)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: calc(100vh - 100px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 580px;
  border-radius: var(--radius-lg);
  padding: 40px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
}

.logo {
  text-align: center;
  margin-bottom: 32px;
}

.logo-emoji {
  font-size: 40px;
  display: inline-block;
  margin-bottom: 8px;
}

.logo h1 {
  font-size: 32px;
  font-weight: 800;
  margin-bottom: 4px;
}

.logo h1 span {
  color: var(--primary);
}

.subtitle {
  color: var(--text-muted);
  font-size: 15px;
  font-weight: 500;
}

.error-banner {
  background-color: var(--danger-light);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  margin-bottom: 24px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.login-options {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.option-card {
  padding: 20px;
  border-radius: var(--radius-md);
  background-color: var(--bg-main);
  border: 1px solid var(--border-color);
}

.option-card h2 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
}

.option-card p {
  color: var(--text-muted);
  font-size: 13px;
  margin-bottom: 16px;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.divider::before, .divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--border-color);
}

.divider span {
  padding: 0 10px;
}

.guest-form, .local-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.btn-block {
  width: 100%;
  justify-content: center;
}
</style>
