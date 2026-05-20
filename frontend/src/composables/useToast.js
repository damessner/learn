import { ref } from 'vue';

const toasts = ref([]);
let _toastCounter = 0;

export function useToast() {
  function showToast(message, type = 'info') {
    const id = ++_toastCounter;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, 3000);
  }

  return { toasts, showToast };
}
