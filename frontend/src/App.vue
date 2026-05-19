<template>
  <div class="app-container">
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
          <button @click="logout" class="btn-logout" title="Sign Out">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
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
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const user = ref(null)

const loadUser = () => {
  const userStr = localStorage.getItem('user')
  user.value = userStr ? JSON.parse(userStr) : null
}

watch(() => route.path, loadUser)
onMounted(loadUser)

const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  user.value = null
  router.push('/login')
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

.logo-text {
  color: var(--text-main);
}

.logo-text span {
  color: var(--primary);
}

.header-nav {
  display: flex;
  gap: 16px;
}

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

.user-menu {
  display: flex;
  align-items: center;
  gap: 12px;
}

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

.user-name {
  font-weight: 600;
  color: var(--text-main);
  font-size: 14px;
}

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

.btn-logout:hover {
  color: var(--danger);
  background-color: var(--danger-light);
}

.main-content {
  flex: 1;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
}

/* Page Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
