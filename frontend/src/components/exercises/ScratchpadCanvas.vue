<template>
  <div 
    v-show="isOpen"
    class="scratchpad-window card glass" 
    :style="windowStyle"
    ref="windowRef"
  >
    <!-- Header / Drag bar -->
    <div class="scratchpad-header" @mousedown="startDrag" @touchstart.passive="startDrag">
      <div class="title-section">
        <span>📝 Scratchpad</span>
        <span class="sub-note">(Drag to move)</span>
      </div>
      <div class="window-actions">
        <button class="icon-btn" @click="clearCanvas" title="Clear Canvas">🧹</button>
        <button class="icon-btn close-btn" @click="$emit('close')" title="Close">✕</button>
      </div>
    </div>

    <!-- Drawing canvas and toolbar area -->
    <div class="scratchpad-body">
      <!-- Toolbar -->
      <div class="scratchpad-toolbar no-print">
        <!-- Tools: Brush / Eraser -->
        <div class="tool-group">
          <button 
            class="tool-btn" 
            :class="{ active: mode === 'draw' }" 
            @click="setMode('draw')"
            title="Draw"
          >
            ✏️
          </button>
          <button 
            class="tool-btn" 
            :class="{ active: mode === 'erase' }" 
            @click="setMode('erase')"
            title="Eraser"
          >
            🧽
          </button>
        </div>

        <!-- Color Selection -->
        <div v-show="mode === 'draw'" class="tool-group colors">
          <button 
            v-for="color in colors" 
            :key="color.value"
            class="color-dot"
            :class="{ active: currentColor === color.value }"
            :style="{ backgroundColor: color.value }"
            @click="setColor(color.value)"
            :title="color.label"
          ></button>
        </div>

        <!-- Size Selection -->
        <div class="tool-group">
          <button 
            v-for="size in sizes" 
            :key="size.value"
            class="size-btn"
            :class="{ active: currentSize === size.value }"
            @click="setSize(size.value)"
            :title="size.label"
          >
            <span class="size-dot" :style="{ width: size.value + 'px', height: size.value + 'px' }"></span>
          </button>
        </div>
      </div>

      <!-- Canvas container -->
      <div class="canvas-container" ref="canvasContainerRef">
        <canvas 
          ref="canvasRef"
          @mousedown="startDrawing"
          @mousemove="draw"
          @mouseup="stopDrawing"
          @mouseleave="stopDrawing"
          @touchstart="startDrawingTouch"
          @touchmove="drawTouch"
          @touchend="stopDrawing"
        ></canvas>
      </div>
    </div>
    
    <!-- Resize Handle -->
    <div class="resize-handle" @mousedown="startResize" @touchstart.passive="startResize"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  assignmentId: { type: String, required: true }
})

const emit = defineEmits(['close'])

// Position & size state (centered by default)
const width = ref(450)
const height = ref(350)
const x = ref(100)
const y = ref(150)

const windowRef = ref(null)
const canvasContainerRef = ref(null)
const canvasRef = ref(null)
let ctx = null

// Drawing state
const isDrawing = ref(false)
const mode = ref('draw') // 'draw' or 'erase'
const currentColor = ref('hsl(250, 85%, 57%)') // Default primary indigo
const currentSize = ref(4)

const colors = [
  { value: '#0f172a', label: 'Dark' },
  { value: 'hsl(250, 85%, 57%)', label: 'Indigo' },
  { value: 'hsl(185, 85%, 45%)', label: 'Cyan' },
  { value: 'hsl(142, 70%, 45%)', label: 'Green' },
  { value: 'hsl(350, 80%, 55%)', label: 'Red' }
]

const sizes = [
  { value: 2, label: 'Thin' },
  { value: 5, label: 'Medium' },
  { value: 10, label: 'Thick' }
]

// Dragging and resizing state
let dragging = false
let dragStartX = 0
let dragStartY = 0
let resizing = false
let resizeStartWidth = 0
let resizeStartHeight = 0

const windowStyle = computed(() => {
  return {
    width: `${width.value}px`,
    height: `${height.value}px`,
    left: `${x.value}px`,
    top: `${y.value}px`,
    position: 'fixed',
    zIndex: 9999
  }
})

// Initialize window positioning
onMounted(() => {
  // Center window on initial mount
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight
  x.value = Math.max(20, (screenWidth - width.value) / 2)
  y.value = Math.max(100, (screenHeight - height.value) / 2)

  window.addEventListener('mouseup', endDragOrResize)
  window.addEventListener('mousemove', handleDragOrResize)
  window.addEventListener('touchend', endDragOrResize)
  window.addEventListener('touchmove', handleDragOrResizeTouch)

  nextTick(() => {
    initCanvas()
  })
})

onUnmounted(() => {
  window.removeEventListener('mouseup', endDragOrResize)
  window.removeEventListener('mousemove', handleDragOrResize)
  window.removeEventListener('touchend', endDragOrResize)
  window.removeEventListener('touchmove', handleDragOrResizeTouch)
})

// Initialize canvas
const initCanvas = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d', { willReadFrequently: true })
  
  resizeCanvas()
  loadCanvasDrawing()
}

// Watch isOpen to refresh canvas size and content
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    nextTick(() => {
      // Ensure canvas matches its container
      if (canvasRef.value) {
        // Save current drawing content
        const tempImage = canvasRef.value.toDataURL()
        resizeCanvas()
        
        // Restore drawing content
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0)
        }
        img.src = tempImage
      }
    })
  }
})

const resizeCanvas = () => {
  const canvas = canvasRef.value
  const container = canvasContainerRef.value
  if (!canvas || !container) return

  // Set buffer size to match bounding box in CSS
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight
  
  // Re-apply style properties on context
  if (ctx) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    updateContextStyle()
  }
}

const updateContextStyle = () => {
  if (!ctx) return
  if (mode.value === 'erase') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
    ctx.lineWidth = currentSize.value * 2.5 // Eraser is slightly wider
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = currentColor.value
    ctx.lineWidth = currentSize.value
  }
}

// Drawing Actions
const setMode = (newMode) => {
  mode.value = newMode
  updateContextStyle()
}

const setColor = (color) => {
  currentColor.value = color
  mode.value = 'draw'
  updateContextStyle()
}

const setSize = (size) => {
  currentSize.value = size
  updateContextStyle()
}

const clearCanvas = () => {
  if (!canvasRef.value || !ctx) return
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  saveCanvasDrawing()
}

// Get drawing coordinates relative to canvas
const getCoordinates = (event) => {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}

const getCoordinatesTouch = (event) => {
  const canvas = canvasRef.value
  if (!canvas || !event.touches.length) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return {
    x: event.touches[0].clientX - rect.left,
    y: event.touches[0].clientY - rect.top
  }
}

// Mouse events
const startDrawing = (event) => {
  isDrawing.value = true
  const coords = getCoordinates(event)
  ctx.beginPath()
  ctx.moveTo(coords.x, coords.y)
}

const draw = (event) => {
  if (!isDrawing.value) return
  const coords = getCoordinates(event)
  ctx.lineTo(coords.x, coords.y)
  ctx.stroke()
}

// Touch events (for iPad/tablets)
const startDrawingTouch = (event) => {
  // Prevent page scroll when drawing on canvas
  event.preventDefault()
  isDrawing.value = true
  const coords = getCoordinatesTouch(event)
  ctx.beginPath()
  ctx.moveTo(coords.x, coords.y)
}

const drawTouch = (event) => {
  event.preventDefault()
  if (!isDrawing.value) return
  const coords = getCoordinatesTouch(event)
  ctx.lineTo(coords.x, coords.y)
  ctx.stroke()
}

const stopDrawing = () => {
  if (isDrawing.value) {
    ctx.closePath()
    isDrawing.value = false
    saveCanvasDrawing()
  }
}

// Save & Load Canvas
const saveCanvasDrawing = () => {
  if (!canvasRef.value) return
  const dataURL = canvasRef.value.toDataURL()
  localStorage.setItem(`learnflow-scratchpad-${props.assignmentId}`, dataURL)
}

const loadCanvasDrawing = () => {
  const savedData = localStorage.getItem(`learnflow-scratchpad-${props.assignmentId}`)
  if (savedData && ctx) {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
    }
    img.src = savedData
  }
}

// Draggable Window Logic
const startDrag = (event) => {
  // Only allow drag if clicking the header or direct title, not action buttons
  if (event.target.closest('.window-actions') || event.target.closest('.icon-btn')) return
  dragging = true
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const clientY = event.touches ? event.touches[0].clientY : event.clientY
  dragStartX = clientX - x.value
  dragStartY = clientY - y.value
}

// Resizable Window Logic
const startResize = (event) => {
  resizing = true
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const clientY = event.touches ? event.touches[0].clientY : event.clientY
  dragStartX = clientX
  dragStartY = clientY
  resizeStartWidth = width.value
  resizeStartHeight = height.value
  event.preventDefault()
}

const endDragOrResize = () => {
  dragging = false
  resizing = false
}

const handleDragOrResize = (event) => {
  if (dragging) {
    x.value = event.clientX - dragStartX
    y.value = event.clientY - dragStartY
  } else if (resizing) {
    const deltaX = event.clientX - dragStartX
    const deltaY = event.clientY - dragStartY
    
    // Set boundaries
    width.value = Math.max(300, Math.min(1000, resizeStartWidth + deltaX))
    height.value = Math.max(250, Math.min(800, resizeStartHeight + deltaY))
    
    nextTick(() => {
      // Re-initialize canvas mapping on resize
      const canvas = canvasRef.value
      if (canvas) {
        const tempImage = canvas.toDataURL()
        resizeCanvas()
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0)
        }
        img.src = tempImage
      }
    })
  }
}

const handleDragOrResizeTouch = (event) => {
  if (!event.touches.length) return
  const touch = event.touches[0]
  if (dragging) {
    x.value = touch.clientX - dragStartX
    y.value = touch.clientY - dragStartY
  } else if (resizing) {
    const deltaX = touch.clientX - dragStartX
    const deltaY = touch.clientY - dragStartY
    
    width.value = Math.max(300, Math.min(1000, resizeStartWidth + deltaX))
    height.value = Math.max(250, Math.min(800, resizeStartHeight + deltaY))
    
    nextTick(() => {
      const canvas = canvasRef.value
      if (canvas) {
        const tempImage = canvas.toDataURL()
        resizeCanvas()
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0)
        }
        img.src = tempImage
      }
    })
  }
}
</script>

<style scoped>
.scratchpad-window {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  user-select: none;
}

.scratchpad-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background-color: var(--primary-light);
  border-bottom: 1px solid var(--border-color);
  cursor: move;
  font-weight: 700;
  font-size: 15px;
  color: var(--primary);
}

.title-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sub-note {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.window-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: auto;
  box-shadow: none;
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.icon-btn:hover {
  opacity: 1;
}

.close-btn {
  font-size: 14px;
  color: var(--text-muted);
}

.close-btn:hover {
  color: var(--danger);
}

.scratchpad-body {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
}

.scratchpad-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 16px;
  background-color: var(--bg-main);
  border-bottom: 1px solid var(--border-color);
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-btn {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  min-height: 32px;
  box-shadow: none;
}

.tool-btn.active {
  background-color: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary);
}

.colors {
  display: flex;
  gap: 6px;
  border-left: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  padding: 0 12px;
}

.color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  min-height: auto;
  box-shadow: none;
}

.color-dot.active {
  border-color: var(--text-main);
  transform: scale(1.15);
}

.size-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  min-height: auto;
  box-shadow: none;
}

.size-btn.active {
  border-color: var(--primary);
  background-color: var(--primary-light);
}

.size-dot {
  background-color: var(--text-main);
  border-radius: 50%;
  display: inline-block;
}

.canvas-container {
  flex-grow: 1;
  position: relative;
  background-color: #ffffff;
}

/* Light grid overlay for a mathematical look */
.canvas-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  background-size: 20px 20px;
  background-image: 
    linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px);
}

@media (prefers-color-scheme: dark) {
  .canvas-container::before {
    background-image: 
      linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px);
  }
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;
  cursor: crosshair;
  touch-action: none; /* Prevents default panning/zooming on tablets while drawing */
}

.resize-handle {
  width: 15px;
  height: 15px;
  background: transparent;
  position: absolute;
  right: 0;
  bottom: 0;
  cursor: se-resize;
  z-index: 10;
}

/* Corner stripes visual style for resize */
.resize-handle::after {
  content: '';
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--text-muted);
  border-bottom: 2px solid var(--text-muted);
}
</style>
