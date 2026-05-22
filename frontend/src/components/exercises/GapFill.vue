<template>
  <div class="exercise-card gap-fill-exercise">
    <div class="exercise-header">
      <span class="exercise-badge">Gap Fill</span>
      <span class="points">{{ points }} pts</span>
    </div>
    
    <div class="instruction" v-math="instruction"></div>

    <div class="gap-text-container" ref="containerRef" @input="handleInput"></div>
    
    <div v-if="isGraded && explanation" class="explanation-box">
      <strong>Explanation:</strong> {{ explanation }}
    </div>
  </div>
</template>

<script setup>
import { computed, watch, ref, onMounted, nextTick } from 'vue'

const props = defineProps({
  id: String,
  template: String,
  points: Number,
  instruction: {
    type: String,
    default: 'Fill in the blanks with the correct words.'
  },
  modelValue: {
    type: Array,
    default: () => []
  },
  disabled: Boolean,
  feedback: Object, // feedback data from submission (if graded)
  explanation: String
})

const emit = defineEmits(['update:modelValue'])

const containerRef = ref(null)
const answers = ref([...props.modelValue])

// State machine template parser
const parseTemplate = (templateStr) => {
  let inDisplayMath = false
  let inInlineMath = false
  let result = ''
  let i = 0
  let gapCounter = 0
  const gapsList = []
  
  while (i < templateStr.length) {
    if (templateStr.startsWith('$$', i)) {
      inDisplayMath = !inDisplayMath
      result += '$$'
      i += 2
      continue
    }
    if (templateStr.startsWith('$', i)) {
      inInlineMath = !inInlineMath
      result += '$'
      i += 1
      continue
    }
    
    if (templateStr.startsWith('((', i)) {
      const endIdx = templateStr.indexOf('))', i + 2)
      if (endIdx !== -1) {
        const gapValue = templateStr.substring(i + 2, endIdx)
        const gapId = `GAPX${gapCounter}GAP`
        
        if (inDisplayMath || inInlineMath) {
          result += `\\text{${gapId}}`
        } else {
          result += gapId
        }
        
        gapsList.push({
          index: gapCounter,
          value: gapValue,
          inMath: inDisplayMath || inInlineMath
        })
        
        gapCounter++
        i = endIdx + 2
        continue
      }
    }
    
    result += templateStr[i]
    i++
  }
  
  return { processedTemplate: result, gaps: gapsList }
}

const parsedData = computed(() => {
  return parseTemplate(props.template || '')
})

// Replace placeholders recursively in the DOM
const replacePlaceholders = (container, gaps, currentAnswers, isGraded, feedback, disabled) => {
  const deepestMatches = []
  
  function findDeepestGaps(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (/GAPX\d+GAP/.test(node.nodeValue)) {
        deepestMatches.push({ type: 'text', node })
      }
      return
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const text = node.textContent || ''
      if (/GAPX\d+GAP/.test(text)) {
        let hasChildMatch = false
        for (const child of node.childNodes) {
          if (child.nodeType === Node.ELEMENT_NODE && /GAPX\d+GAP/.test(child.textContent || '')) {
            hasChildMatch = true
            break
          }
          if (child.nodeType === Node.TEXT_NODE && /GAPX\d+GAP/.test(child.nodeValue || '')) {
            hasChildMatch = true
            break
          }
        }
        
        if (!hasChildMatch) {
          deepestMatches.push({ type: 'element', node })
        } else {
          for (const child of node.childNodes) {
            findDeepestGaps(child)
          }
        }
      }
    }
  }
  
  findDeepestGaps(container)
  
  function createInputWrapper(gapIdx, gapInfo) {
    const inputWrapper = document.createElement('span')
    inputWrapper.className = 'input-segment'
    if (gapInfo.inMath) {
      inputWrapper.classList.add('math-input-wrapper')
    }
    
    if (isGraded) {
      const correctAnswers = feedback?.correctAnswers || []
      const correctVal = correctAnswers[gapIdx] || ''
      const studentVal = (currentAnswers[gapIdx] || '').toLowerCase().trim()
      const isCorrect = studentVal === correctVal.toLowerCase().trim()
      inputWrapper.className += isCorrect ? ' correct' : ' incorrect'
    }
    
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'gap-input'
    input.value = currentAnswers[gapIdx] || ''
    input.disabled = disabled || isGraded
    input.placeholder = isGraded ? '' : '...'
    input.setAttribute('data-gap-index', gapIdx.toString())
    
    const charLength = gapInfo.value.length
    input.style.width = `${Math.max(charLength * 11, 45)}px`
    
    inputWrapper.appendChild(input)
    
    if (isGraded) {
      const correctAnswers = feedback?.correctAnswers || []
      const correctVal = correctAnswers[gapIdx] || ''
      const studentVal = (currentAnswers[gapIdx] || '').toLowerCase().trim()
      const isCorrect = studentVal === correctVal.toLowerCase().trim()
      if (!isCorrect) {
        const reveal = document.createElement('span')
        reveal.className = 'correct-answer-reveal'
        reveal.textContent = ` (${correctVal})`
        inputWrapper.appendChild(reveal)
      }
    }
    
    return inputWrapper
  }
  
  // Now process each match
  for (const match of deepestMatches) {
    if (match.type === 'text') {
      const node = match.node
      const text = node.nodeValue
      const parent = node.parentNode
      if (!parent) continue
      
      const parts = text.split(/(GAPX\d+GAP)/g)
      const fragment = document.createDocumentFragment()
      
      for (const part of parts) {
        const m = /^GAPX(\d+)GAP$/.exec(part)
        if (m) {
          const gapIdx = parseInt(m[1], 10)
          const gapInfo = gaps[gapIdx]
          
          if (!gapInfo) {
            fragment.appendChild(document.createTextNode(part))
            continue
          }
          
          const inputWrapper = createInputWrapper(gapIdx, gapInfo)
          fragment.appendChild(inputWrapper)
        } else if (part) {
          fragment.appendChild(document.createTextNode(part))
        }
      }
      parent.replaceChild(fragment, node)
    } else if (match.type === 'element') {
      const node = match.node
      const text = node.textContent || ''
      const m = /GAPX(\d+)GAP/.exec(text)
      if (m) {
        const gapIdx = parseInt(m[1], 10)
        const gapInfo = gaps[gapIdx]
        if (gapInfo) {
          // Clear children
          node.innerHTML = ''
          const inputWrapper = createInputWrapper(gapIdx, gapInfo)
          node.appendChild(inputWrapper)
        }
      }
    }
  }
}

const isGraded = computed(() => !!props.feedback)

const renderAndReplace = () => {
  if (!containerRef.value) return
  
  const { processedTemplate, gaps } = parsedData.value
  
  // 1. Write the template with placeholders
  containerRef.value.innerHTML = processedTemplate
  
  // 2. Render LaTeX using KaTeX
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(containerRef.value, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      })
    } catch (e) {
      console.error('KaTeX rendering error:', e)
    }
  }
  
  // 3. Swap placeholders for input elements
  replacePlaceholders(
    containerRef.value,
    gaps,
    answers.value,
    isGraded.value,
    props.feedback,
    props.disabled
  )
}

const handleInput = (e) => {
  if (e.target && e.target.classList.contains('gap-input')) {
    const gapIdx = parseInt(e.target.getAttribute('data-gap-index'), 10)
    answers.value[gapIdx] = e.target.value
  }
}

// Initialize answers length
watch(parsedData, (newData) => {
  const gapCount = newData.gaps.length
  while (answers.value.length < gapCount) {
    answers.value.push('')
  }
  nextTick(renderAndReplace)
}, { immediate: true })

watch(answers, (newVal) => {
  emit('update:modelValue', newVal)
  if (containerRef.value) {
    const inputs = containerRef.value.querySelectorAll('.gap-input')
    inputs.forEach((input) => {
      const gapIdx = parseInt(input.getAttribute('data-gap-index'), 10)
      if (input.value !== newVal[gapIdx]) {
        input.value = newVal[gapIdx] || ''
      }
    })
  }
}, { deep: true })

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    let changed = false
    for (let i = 0; i < newVal.length; i++) {
      if (answers.value[i] !== newVal[i]) {
        answers.value[i] = newVal[i]
        changed = true
      }
    }
    if (changed && containerRef.value) {
      const inputs = containerRef.value.querySelectorAll('.gap-input')
      inputs.forEach((input) => {
        const gapIdx = parseInt(input.getAttribute('data-gap-index'), 10)
        if (input.value !== answers.value[gapIdx]) {
          input.value = answers.value[gapIdx] || ''
        }
      })
    }
  }
}, { deep: true })

watch(
  [isGraded, () => props.feedback, () => props.disabled],
  () => {
    nextTick(renderAndReplace)
  }
)

onMounted(() => {
  renderAndReplace()
})
</script>

<style>
.gap-fill-exercise.exercise-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 24px;
}

.gap-fill-exercise .exercise-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.gap-fill-exercise .exercise-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  background-color: var(--primary-light);
  color: var(--primary);
  padding: 4px 8px;
  border-radius: 20px;
}

.gap-fill-exercise .points {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
}

.gap-fill-exercise .instruction {
  font-weight: 600;
  margin-bottom: 16px;
  font-size: 15px;
}

.gap-fill-exercise .gap-text-container {
  line-height: 2.2;
  font-size: 17px;
}

.gap-fill-exercise .text-segment {
  color: var(--text-main);
}

.gap-fill-exercise .input-segment {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  margin: 0 4px;
  vertical-align: middle;
}

.gap-fill-exercise .gap-input {
  min-height: 36px;
  padding: 4px 8px;
  text-align: center;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  font-size: 16px;
  font-weight: 600;
  background-color: var(--bg-main);
  transition: all 0.2s ease;
}

.gap-fill-exercise .gap-input:focus {
  border-color: var(--primary);
  background-color: var(--bg-card);
}

.gap-fill-exercise .input-segment.correct .gap-input {
  background-color: var(--success-light);
  border-color: var(--success);
  color: var(--success);
}

.gap-fill-exercise .input-segment.incorrect .gap-input {
  background-color: var(--danger-light);
  border-color: var(--danger);
  color: var(--danger);
  text-decoration: line-through;
}

.gap-fill-exercise .correct-answer-reveal {
  font-size: 12px;
  color: var(--success);
  font-weight: 700;
  margin-top: 2px;
}

/* Specific styling for inputs embedded inside KaTeX formulas */
.gap-fill-exercise .math-input-wrapper {
  margin: 0 2px;
}

.gap-fill-exercise .math-input-wrapper .gap-input {
  min-height: 26px;
  height: 26px;
  font-size: 13px;
  padding: 2px 4px;
}
</style>
