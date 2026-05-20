import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import StudentDashboard from '../views/StudentDashboard.vue'
import TeacherDashboard from '../views/TeacherDashboard.vue'
import WorksheetPlayer from '../views/WorksheetPlayer.vue'
import WorksheetBuilder from '../views/WorksheetBuilder.vue'
import WorksheetPreview from '../views/WorksheetPreview.vue'
import CourseView from '../views/CourseView.vue'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/student',
    name: 'StudentDashboard',
    component: StudentDashboard,
    meta: { requiresAuth: true, role: 'student' }
  },
  {
    path: '/student/course/:id',
    name: 'CourseView',
    component: CourseView,
    meta: { requiresAuth: true, role: 'student' }
  },
  {
    path: '/student/assignment/:id',
    name: 'WorksheetPlayer',
    component: WorksheetPlayer,
    meta: { requiresAuth: true, role: 'student' }
  },
  {
    path: '/teacher',
    name: 'TeacherDashboard',
    component: TeacherDashboard,
    meta: { requiresAuth: true, role: ['teacher', 'admin'] }
  },
  {
    path: '/teacher/builder/:id?',
    name: 'WorksheetBuilder',
    component: WorksheetBuilder,
    meta: { requiresAuth: true, role: ['teacher', 'admin'] }
  },
  {
    path: '/teacher/preview/:id',
    name: 'WorksheetPreview',
    component: WorksheetPreview,
    meta: { requiresAuth: true, role: ['teacher', 'admin'] }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Route guard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : null

  if (to.meta.requiresAuth) {
    if (!token || !user) {
      next('/login')
    } else {
      // Check roles
      const requiredRole = to.meta.role
      if (Array.isArray(requiredRole)) {
        if (requiredRole.includes(user.role)) {
          next()
        } else {
          next(user.role === 'student' ? '/student' : '/teacher')
        }
      } else if (requiredRole && user.role !== requiredRole) {
        next(user.role === 'student' ? '/student' : '/teacher')
      } else {
        next()
      }
    }
  } else {
    // If logged in, redirect away from login
    if (to.path === '/login' && token && user) {
      next(user.role === 'student' ? '/student' : '/teacher')
    } else {
      next()
    }
  }
})

export default router
