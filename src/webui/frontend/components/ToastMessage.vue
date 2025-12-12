<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toast } = useToast()
</script>

<template>
  <Transition 
    enter-active-class="transform ease-out duration-300 transition" 
    enter-from-class="translate-y-2 opacity-0 scale-95" 
    enter-to-class="translate-y-0 opacity-100 scale-100" 
    leave-active-class="transition ease-in duration-200" 
    leave-from-class="opacity-100 scale-100" 
    leave-to-class="opacity-0 scale-95"
  >
    <div v-if="toast.show" 
         class="absolute bottom-6 right-6 px-4 py-3 rounded-lg shadow-md border text-sm font-medium flex items-center gap-3 z-50 bg-bg-secondary"
         :class="toast.type === 'success' ? 'border-accent-green/30 text-accent-green' : 'border-accent-red/30 text-accent-red'">
      <span class="text-lg">{{ toast.type === 'success' ? '✓' : '✕' }}</span>
      {{ toast.message }}
    </div>
  </Transition>
</template>
