<template>
  <div class="video-block">
    <div v-if="embedUrl" class="video-wrapper">
      <iframe
        :src="embedUrl"
        class="youtube-iframe"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        :title="caption || 'Video'"
      ></iframe>
    </div>
    <div v-else class="video-placeholder">
      <span>🎬</span>
      <p>No valid YouTube URL provided.</p>
    </div>
    <p v-if="caption" class="caption">{{ caption }}</p>

    <!-- Questions shown below the video -->
    <div v-if="questions && questions.length > 0" class="video-questions">
      <h4 class="questions-heading">📋 Questions about this video</h4>
      <div
        v-for="(q, idx) in questions"
        :key="idx"
        class="video-question-item"
      >
        <p class="question-text">{{ idx + 1 }}. {{ q.text }}</p>
        <textarea
          v-if="!disabled"
          v-model="localAnswers[idx]"
          @input="emitAnswers"
          class="question-textarea"
          :placeholder="q.placeholder || 'Type your answer here...'"
          rows="2"
        ></textarea>
        <div v-else class="question-answer-display">{{ localAnswers[idx] || '—' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  url: String,
  caption: String,
  questions: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  },
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

const localAnswers = ref(Array.isArray(props.modelValue) ? [...props.modelValue] : [])

watch(() => props.modelValue, (val) => {
  if (Array.isArray(val)) localAnswers.value = [...val]
}, { deep: true })

const emitAnswers = () => {
  emit('update:modelValue', [...localAnswers.value])
}

function extractYouTubeId(url) {
  if (!url) return null
  // Handle youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortMatch) return shortMatch[1]
  // Handle youtube.com/watch?v=ID
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (watchMatch) return watchMatch[1]
  // Handle youtube.com/embed/ID
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch) return embedMatch[1]
  return null
}

const embedUrl = computed(() => {
  const id = extractYouTubeId(props.url)
  if (!id) return null
  return `https://www.youtube.com/embed/${id}`
})
</script>

<style scoped>
.video-block {
  margin-bottom: 24px;
}

.video-wrapper {
  position: relative;
  padding-top: 56.25%; /* 16:9 aspect ratio */
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  background: #000;
}

.youtube-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  gap: 8px;
  font-size: 0.9rem;
}

.video-placeholder span {
  font-size: 2rem;
}

.caption {
  font-size: 14px;
  color: var(--text-muted);
  margin-top: 8px;
  font-style: italic;
  text-align: center;
}

.video-questions {
  margin-top: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.questions-heading {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-main);
}

.video-question-item {
  margin-bottom: 14px;
}

.question-text {
  font-size: 0.95rem;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--text-main);
}

.question-textarea {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-main);
  font-size: 0.9rem;
  resize: vertical;
  box-sizing: border-box;
}

.question-answer-display {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 1px solid var(--border-color);
  font-size: 0.9rem;
  color: var(--text-main);
  min-height: 36px;
}
</style>
