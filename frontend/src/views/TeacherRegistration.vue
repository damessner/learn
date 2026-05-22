<template>
  <div class="auth-wrapper">
    <div class="auth-card">
      <div class="auth-header">
        <h1>Teacher Registration</h1>
        <p>Welcome to LearnFlow! Create your teacher account below.</p>
      </div>

      <div class="auth-body">
        <form @submit.prevent="register">
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" v-model="form.name" required placeholder="Dr. Maria Schmidt" />
          </div>
          
          <div class="form-group">
            <label>Username (or Email)</label>
            <input type="text" v-model="form.username" required placeholder="maria.schmidt" />
          </div>

          <div class="form-group">
            <label>Password</label>
            <input type="password" v-model="form.password" required placeholder="Choose a strong password" />
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;" :disabled="loading">
            <span v-if="loading">Creating Account...</span>
            <span v-else>Register</span>
          </button>
        </form>

        <p v-if="error" class="error-msg">{{ error }}</p>
      </div>
      
      <div class="auth-footer">
        <router-link to="/login">Already have an account? Log in.</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const form = ref({
  name: '',
  username: '',
  password: ''
})

const loading = ref(false)
const error = ref('')
const token = ref('')

onMounted(() => {
  token.value = route.query.token || ''
  if (!token.value) {
    error.value = 'Missing registration token. Please make sure you clicked the full link provided by your administrator.'
  }
})

const register = async () => {
  if (!token.value) {
    error.value = 'Cannot register without a valid token.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const API_BASE = '/api'
    const res = await fetch(`${API_BASE}/auth/register-teacher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token.value,
        name: form.value.name,
        username: form.value.username,
        password: form.value.password,
        email: form.value.username // use username as email if provided
      })
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed')
    }

    // Auto log in
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    
    // Redirect to dashboard
    router.push('/teacher')

  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--bg-color);
  padding: 2rem;
}

.auth-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}

.auth-header p {
  color: var(--text-color);
  opacity: 0.8;
  font-size: 0.95rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-color);
  font-size: 1rem;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.error-msg {
  color: #ef4444;
  font-size: 0.85rem;
  margin-top: 1rem;
  text-align: center;
}

.auth-footer {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.9rem;
}

.auth-footer a {
  color: var(--primary-color);
  text-decoration: none;
}

.auth-footer a:hover {
  text-decoration: underline;
}
</style>
