<template>
  <div class="read-aloud-block card glass">
    <!-- Block Header with Title/Label & Language Badge -->
    <div class="block-header-hud">
      <div class="header-left-hud">
        <span class="speech-icon-badge">🗣️</span>
        <div class="label-info">
          <h4 class="block-title">{{ label || 'Read Aloud' }}</h4>
          <span class="lang-badge" v-if="language">
            {{ getLangFlag(language) }} {{ getLangName(language) }}
          </span>
        </div>
      </div>
      <div class="voice-badge" v-if="engine === 'cloud'">
        ✨ Neural Voice
      </div>
    </div>

    <!-- Read Along Text Content Section -->
    <div class="read-text-content" :class="{ 'has-audio': !!url }">
      <p class="text-display">{{ text || 'No text provided yet.' }}</p>
    </div>

    <!-- Audio Player Section -->
    <div class="audio-player-hud" v-if="url">
      <audio 
        ref="audioRef" 
        :src="computedUrl"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @ended="isPlaying = false"
      ></audio>

      <div class="player-controls">
        <button @click="togglePlay" class="btn-play-pause" :title="isPlaying ? 'Pause' : 'Play'">
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
    <div class="no-audio-warning" v-else>
      ⚠️ Audio has not been generated for this text yet.
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  url: String,
  label: String,
  text: String,
  language: String,
  engine: String,
  voice: String
})

const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const audioRef = ref(null)

const API_BASE = ''

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
      console.error("Read aloud playback error:", err)
    })
  }
}

const seek = () => {
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

const getLangFlag = (lang) => {
  switch (lang) {
    case 'de-AT': return '🇦🇹'
    case 'de-DE': return '🇩🇪'
    case 'en-US': return '🇺🇸'
    case 'en-GB': return '🇬🇧'
    default: return '🌐'
  }
}

const getLangName = (lang) => {
  switch (lang) {
    case 'de-AT': return 'Austrian German'
    case 'de-DE': return 'German'
    case 'en-US': return 'English (US)'
    case 'en-GB': return 'English (UK)'
    default: return lang
  }
}
</script>

<style scoped>
.read-aloud-block {
  padding: 20px;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 650px;
  margin-left: auto;
  margin-right: auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  transition: box-shadow 0.3s ease;
}

.read-aloud-block:hover {
  box-shadow: var(--shadow-md);
}

.block-header-hud {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 12px;
}

.header-left-hud {
  display: flex;
  align-items: center;
  gap: 12px;
}

.speech-icon-badge {
  font-size: 28px;
  background-color: var(--primary-light);
  padding: 8px;
  border-radius: var(--radius-md);
  line-height: 1;
}

.label-info {
  display: flex;
  flex-direction: column;
}

.block-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: var(--text-main);
}

.lang-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-top: 2px;
}

.voice-badge {
  font-size: 11px;
  font-weight: 700;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 4px 8px;
  border-radius: 20px;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

.read-text-content {
  background-color: var(--bg-main);
  border-radius: var(--radius-md);
  padding: 16px;
  border: 1px dashed var(--border-color);
}

.read-text-content.has-audio {
  border-style: solid;
  border-left: 4px solid var(--primary);
}

.text-display {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-main);
  margin: 0;
  white-space: pre-wrap;
}

.audio-player-hud {
  background-color: var(--bg-main);
  border-radius: var(--radius-md);
  padding: 12px 16px;
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
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border: none;
  cursor: pointer;
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

.no-audio-warning {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  padding: 8px;
  background-color: var(--bg-main);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}
</style>
