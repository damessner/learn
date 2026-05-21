import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

const renderMath = (el, value) => {
  const content = value !== undefined && value !== null ? String(value) : ''
  el.innerHTML = content
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      })
    } catch (e) {
      console.error('KaTeX auto-render error:', e)
    }
  }
}

app.directive('math', {
  mounted(el, binding) {
    renderMath(el, binding.value)
  },
  updated(el, binding) {
    renderMath(el, binding.value)
  }
})

app.use(router)
app.mount('#app')

