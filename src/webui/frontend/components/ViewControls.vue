<script setup lang="ts">
import { useConflicts } from '../composables/useConflicts'
import { useDiff } from '../composables/useDiff'

const { selectedItem, processing, saveContent } = useConflicts()
const { getViewMode, toggleView, editContent, parseDiff } = useDiff()
</script>

<template>
  <div v-if="selectedItem" class="px-6 py-3 border-b border-border-color flex items-center justify-between bg-bg-subtle shrink-0">
    <div class="flex items-center p-1 bg-bg-primary border border-border-color rounded-lg">
      <button @click="toggleView('edit')"
              class="px-3 py-1 rounded-md text-xs font-medium transition-all"
              :class="getViewMode() === 'edit' ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'">
        エディタ
      </button>
      <button @click="toggleView('diff')"
              class="px-3 py-1 rounded-md text-xs font-medium transition-all"
              :class="getViewMode() === 'diff' ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'">
        差分表示
      </button>
    </div>
    
    <div v-if="getViewMode() === 'edit'" class="flex gap-2">
       <button @click="saveContent(selectedItem.id, editContent)" 
               :disabled="!!processing"
               class="px-3 py-1 rounded-md text-xs font-medium bg-accent-primary text-bg-primary hover:bg-white/90 transition-colors disabled:opacity-50">
         保存
       </button>
    </div>          
    <div v-if="getViewMode() === 'diff' && selectedItem.gitDiff" class="flex gap-4 text-xs font-mono">
      <span class="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-primary border border-border-color text-accent-green">
        <strong>+{{ parseDiff(selectedItem.gitDiff!).stats.additions }}</strong>
      </span>
      <span class="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-primary border border-border-color text-accent-red">
        <strong>-{{ parseDiff(selectedItem.gitDiff!).stats.deletions }}</strong>
      </span>
    </div>
  </div>
</template>
