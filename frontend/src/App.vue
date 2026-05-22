<template>
  <div class="app-container">
    <ToastNotification />

    <header v-if="user" class="main-header glass">
      <div class="header-content">
        <div class="logo">
          <span class="logo-icon">✨</span>
          <span class="logo-text">Learn<span>Flow</span></span>
        </div>
        <nav class="header-nav">
          <router-link v-if="user.role !== 'student'" to="/teacher" class="nav-link">Dashboard</router-link>
          <router-link v-if="user.role === 'student' && !user.isGuest" to="/student" class="nav-link">My Worksheets</router-link>
        </nav>
        <div class="user-menu">
          <span class="user-badge">{{ user.role }}</span>
          <span class="user-name">{{ user.name }}</span>
          <button @click="toggleTheme" class="btn-icon" :title="isDark ? 'Light mode' : 'Dark mode'">
            <span>{{ isDark ? '☀️' : '🌙' }}</span>
          </button>
          <div class="user-dropdown" ref="dropdownRef">
            <button @click="showDropdown = !showDropdown" class="btn-icon" title="Account">⚙️</button>
            <div v-if="showDropdown" class="dropdown-menu">
              <button @click="openChangePassword">Change Password</button>
              <button @click="logout" class="danger">Sign Out</button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- Change Password Modal -->
    <div v-if="showChangePassword" class="modal-overlay" @click.self="showChangePassword = false">
      <div class="modal-box">
        <h3>Change Password</h3>
        <div class="form-group">
          <label>Current Password</label>
          <input type="password" v-model="cpForm.current" placeholder="Current password" />
        </div>
        <div class="form-group">
          <label>New Password</label>
          <input type="password" v-model="cpForm.newPass" placeholder="New password (min 6 chars)" />
        </div>
        <div class="form-group">
          <label>Confirm New Password</label>
          <input type="password" v-model="cpForm.confirm" placeholder="Confirm new password" />
        </div>
        <p v-if="cpError" class="error-msg">{{ cpError }}</p>
        <div class="modal-actions">
          <button @click="showChangePassword = false" class="btn-secondary">Cancel</button>
          <button @click="submitChangePassword" class="btn-primary" :disabled="cpLoading">
            {{ cpLoading ? 'Saving...' : 'Save Password' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import ToastNotification from './components/ToastNotification.vue'
import { useToast } from './composables/useToast.js'

const router = useRouter()
const route = useRoute()
const { showToast } = useToast()

const user = ref(null)
const isDark = ref(false)
const showDropdown = ref(false)
const dropdownRef = ref(null)
const showChangePassword = ref(false)
const cpForm = ref({ current: '', newPass: '', confirm: '' })
const cpError = ref('')
const cpLoading = ref(false)

const API_BASE = '/api'

const loadUser = () => {
  const userStr = localStorage.getItem('user')
  user.value = userStr ? JSON.parse(userStr) : null
}

const applyTheme = (dark) => {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  applyTheme(isDark.value)
}

const closeDropdownOutside = (e) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    showDropdown.value = false
  }
}

watch(() => route.path, loadUser)
onMounted(() => {
  loadUser()
  const saved = localStorage.getItem('theme')
  isDark.value = saved === 'dark'
  applyTheme(isDark.value)
  document.addEventListener('click', closeDropdownOutside)
})
onBeforeUnmount(() => document.removeEventListener('click', closeDropdownOutside))

const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  user.value = null
  router.push('/login')
}

const openChangePassword = () => {
  showDropdown.value = false
  cpForm.value = { current: '', newPass: '', confirm: '' }
  cpError.value = ''
  showChangePassword.value = true
}

const submitChangePassword = async () => {
  cpError.value = ''
  if (!cpForm.value.current || !cpForm.value.newPass) {
    cpError.value = 'All fields are required.'; return
  }
  if (cpForm.value.newPass !== cpForm.value.confirm) {
    cpError.value = 'New passwords do not match.'; return
  }
  if (cpForm.value.newPass.length < 6) {
    cpError.value = 'New password must be at least 6 characters.'; return
  }
  cpLoading.value = true
  try {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ currentPassword: cpForm.value.current, newPassword: cpForm.value.newPass })
    })
    const data = await res.json()
    if (!res.ok) { cpError.value = data.error || 'Failed to change password'; return }
    showChangePassword.value = false
    showToast('Password changed successfully', 'success')
  } catch (e) {
    cpError.value = 'Network error'
  } finally {
    cpLoading.value = false
  }
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-header {
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid var(--border-color);
  padding: 12px 24px;
  background: var(--bg-card);
}

.header-content {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 800;
  font-family: var(--font-title);
}

.logo-text { color: var(--text-main); }
.logo-text span { color: var(--primary); }

.header-nav { display: flex; gap: 16px; }

.nav-link {
  color: var(--text-muted);
  font-weight: 600;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.nav-link:hover, .router-link-active {
  color: var(--primary);
  background-color: var(--primary-light);
}

.user-menu { display: flex; align-items: center; gap: 12px; }

.user-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  background-color: var(--primary-light);
  color: var(--primary);
  padding: 2px 8px;
  border-radius: 20px;
  letter-spacing: 0.05em;
}

.user-name { font-weight: 600; color: var(--text-main); font-size: 14px; }

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  font-size: 18px;
  border-radius: var(--radius-sm);
  min-height: auto;
}

.user-dropdown { position: relative; }

.dropdown-menu {
  position: absolute;
  right: 0;
  top: 110%;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  min-width: 160px;
  z-index: 200;
  overflow: hidden;
}

.dropdown-menu button {
  width: 100%;
  background: none;
  border: none;
  text-align: left;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
  cursor: pointer;
  min-height: auto;
  border-radius: 0;
}
.dropdown-menu button:hover { background: var(--primary-light); }
.dropdown-menu button.danger { color: var(--danger); }

.btn-logout {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  min-height: auto;
}
.btn-logout:hover { color: var(--danger); background-color: var(--danger-light); }

.main-content {
  flex: 1;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Change Password Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 300;
  display: flex; align-items: center; justify-content: center;
}
.modal-box {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 32px;
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-lg);
}
.modal-box h3 { margin-bottom: 20px; }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text-muted); }
.form-group input {
  width: 100%; padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-main);
  color: var(--text-main);
  font-size: 14px;
}
.error-msg { color: var(--danger); font-size: 13px; margin-bottom: 12px; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }
.btn-primary { background: var(--primary); color: white; padding: 10px 20px; border-radius: var(--radius-sm); border: none; cursor: pointer; font-weight: 600; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border-color); padding: 10px 20px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; }
</style>
