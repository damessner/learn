<template>
  <div class="audio-block card glass">
    <div class="audio-info">
      <span class="audio-icon">🎵</span>
      <div class="text-info">
        <h4 class="audio-title">{{ label || 'Listening Exercise' }}</h4>
        <p class="audio-sub">Tap play to listen to the audio clip.</p>
      </div>
    </div>

    <div class="audio-controls-wrapper">
      <audio 
        ref="audioRef" 
        :src="computedUrl"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @ended="isPlaying = false"
      ></audio>

      <div class="player-controls">
        <button @click="togglePlay" class="btn-play-pause">
          <span v-if="!isPlaying">▶</span>
          <span v-else>❚❚</span>
        </button>

        <div class="timeline-container">
          <span class="time">{{ formatTime(currentTime) }}</span>
          <input 
            type="range" 
            min="0" 
            :max="duration" 
            step="0.1"
            v-model="currentTime" 
            @input="seek" 
            class="seek-slider" 
          />
          <span class="time">{{ formatTime(duration) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  url: String,
  label: String
})

const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const audioRef = ref(null)

const API_BASE = 'http://localhost:3001'

const computedUrl = computed(() => {
  if (!props.url) return ''
  if (props.url.startsWith('http://') || props.url.startsWith('https://')) return props.url
  return `${API_BASE}${props.url}`
})

const togglePlay = () => {
  if (!audioRef.value) return
  if (isPlaying.value) {
    audioRef.value.pause()
    isPlaying.value = false
  } else {
    audioRef.value.play().then(() => {
      isPlaying.value = true
    }).catch(err => {
      console.error("Audio playback error:", err)
    })
  }
}

const seek = (event) => {
  if (!audioRef.value) return
  audioRef.value.currentTime = currentTime.value
}

const onTimeUpdate = () => {
  if (!audioRef.value) return
  currentTime.value = audioRef.value.currentTime
}

const onLoadedMetadata = () => {
  if (!audioRef.value) return
  duration.value = audioRef.value.duration
}

const formatTime = (secs) => {
  if (isNaN(secs)) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}
</script>

<style scoped>
.audio-block {
  padding: 16px 20px;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.audio-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.audio-icon {
  font-size: 32px;
  background-color: var(--primary-light);
  padding: 10px;
  border-radius: var(--radius-md);
  line-height: 1;
}

.audio-title {
  font-size: 16px;
  font-weight: 700;
}

.audio-sub {
  font-size: 13px;
  color: var(--text-muted);
}

.audio-controls-wrapper {
  background-color: var(--bg-main);
  border-radius: var(--radius-md);
  padding: 10px 16px;
  border: 1px solid var(--border-color);
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-play-pause {
  background-color: var(--primary);
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  border: none;
  cursor: pointer;
  min-height: auto;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.btn-play-pause:hover {
  background-color: var(--primary-hover);
  transform: scale(1.05);
}

.timeline-container {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-grow: 1;
}

.time {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  font-family: monospace;
}

.seek-slider {
  flex-grow: 1;
  height: 6px;
  border-radius: 3px;
  accent-color: var(--primary);
  cursor: pointer;
  outline: none;
}
</style>
