<script setup lang="ts">
import { ref } from 'vue'
import { useConflicts } from '../composables/useConflicts'
import { useDiff } from '../composables/useDiff'

const { selectedItem } = useConflicts()
const { editContent, highlightConflicts } = useDiff()

const backdropRef = ref<HTMLDivElement | null>(null)
const lineNumbersRef = ref<HTMLDivElement | null>(null)

const handleScroll = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  // Synchronize line numbers and backdrop scroll
  if (lineNumbersRef.value) {
    lineNumbersRef.value.scrollTop = target.scrollTop
  }
  if (backdropRef.value) {
    backdropRef.value.scrollTop = target.scrollTop
  }
}

</script>

<template>
  <div v-if="selectedItem" class="flex h-full w-full flex-1 overflow-hidden bg-bg-primary">
    <!-- Line Numbers -->
    <div class="shrink-0 w-12 bg-bg-tertiary border-r border-border-color text-right text-text-tertiary select-none overflow-hidden py-6 pr-2 font-mono text-[13px] leading-6"
         ref="lineNumbersRef">
       <div v-for="i in (editContent ? editContent.split('\n').length : 1)" :key="i">{{ i }}</div>
    </div>
    
    <!-- Editor Container -->
    <div class="relative flex-1 h-full overflow-hidden">
      <!-- Backdrop for highlighting -->
      <div class="absolute inset-0 pointer-events-none p-6 font-mono text-[13px] leading-6 whitespace-pre-wrap break-all overflow-hidden z-0"
           ref="backdropRef"
           v-html="highlightConflicts(editContent)">
      </div>
      
      <!-- Textarea for editing -->
      <!-- text-transparent/caret-white trick for overlay editing -->
      <textarea v-model="editContent" 
                @scroll="handleScroll"
                class="absolute inset-0 w-full h-full bg-transparent text-transparent caret-text-primary p-6 font-mono text-[13px] leading-6 resize-none focus:outline-none z-10 break-all"
                spellcheck="false"></textarea>
    </div>
  </div>
</template>
