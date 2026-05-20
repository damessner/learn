<template>
  <div class="media-block">
    <div class="image-wrapper" @click="toggleZoom">
      <img :src="computedUrl" :alt="alt" class="block-image" />
      <div class="zoom-overlay">
        <span>🔍 Tap to Zoom</span>
      </div>
    </div>
    <p v-if="caption" class="caption">{{ caption }}</p>

    <!-- Fullscreen Zoom Lightbox -->
    <div v-if="isZoomed" class="lightbox" @click="toggleZoom">
      <div class="lightbox-content">
        <img :src="computedUrl" :alt="alt" />
        <button class="btn-close-zoom">×</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  url: String,
  alt: {
    type: String,
    default: 'Worksheet Illustration'
  },
  caption: String
})

const isZoomed = ref(false)

const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3001' : ''

const computedUrl = computed(() => {
  if (!props.url) return ''
  if (props.url.startsWith('http://') || props.url.startsWith('https://')) return props.url
  return `${API_BASE}${props.url}`
})

const toggleZoom = () => {
  isZoomed.value = !isZoomed.value
}
</script>

<style scoped>
.media-block {
  margin-bottom: 24px;
  text-align: center;
}

.image-wrapper {
  position: relative;
  display: inline-block;
  max-width: 100%;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  cursor: zoom-in;
}

.block-image {
  max-width: 100%;
  max-height: 400px;
  display: block;
  object-fit: contain;
  transition: transform 0.3s ease;
}

.image-wrapper:hover .block-image {
  transform: scale(1.02);
}

.zoom-overlay {
  position: absolute;
  bottom: 12px;
  right: 12px;
  background-color: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(4px);
  color: white;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  pointer-events: none;
  opacity: 0.8;
}

.caption {
  font-size: 14px;
  color: var(--text-muted);
  margin-top: 8px;
  font-style: italic;
}

/* Lightbox Styling */
.lightbox {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(8px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
  padding: 20px;
}

.lightbox-content {
  position: relative;
  max-width: 90%;
  max-height: 90%;
}

.lightbox-content img {
  max-width: 100%;
  max-height: 80vh;
  border-radius: var(--radius-md);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.btn-close-zoom {
  position: absolute;
  top: -40px;
  right: 0;
  background: none;
  border: none;
  color: white;
  font-size: 32px;
  cursor: pointer;
  min-height: auto;
  box-shadow: none;
}
</style>
