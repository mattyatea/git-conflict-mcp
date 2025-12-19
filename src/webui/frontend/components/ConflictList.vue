<script setup lang="ts">
import { useConflicts } from '../composables/useConflicts'
import { useEditorSettings } from '../composables/useEditorSettings'

const { 
  pendingResolves, 
  selectedId, 
  loadPending, 
  getTypeLabel, 
  formatTime,
  isReviewMode
} = useConflicts()

const { showSettings } = useEditorSettings()
</script>

<template>
  <aside class="w-80 min-w-[320px] flex flex-col border-r border-border-color bg-bg-secondary">
    <header class="h-16 flex items-center justify-between px-5 border-b border-border-color bg-bg-secondary sticky top-0 z-10">
      <div class="flex items-center gap-2.5">
        <div class="w-6 h-6 rounded bg-accent-primary text-bg-primary flex items-center justify-center font-bold text-xs">
          GC
        </div>
        <h1 class="font-medium text-sm tracking-tight text-text-primary">解決待ち一覧</h1>
        <span v-if="isReviewMode" class="ml-2 px-1.5 py-0.5 rounded bg-accent-primary/10 text-accent-primary text-[10px] font-bold border border-accent-primary/20">
          REVIEW MODE
        </span>
      </div>
      <div class="px-2 py-0.5 rounded-full bg-bg-tertiary border border-border-color text-xs font-mono text-text-secondary">
        {{ pendingResolves.length }}
      </div>
    </header>

    <div class="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1 custom-scrollbar">
      <template v-if="pendingResolves.length > 0">
        <button 
          v-for="item in pendingResolves" 
          :key="item.id"
          @click="selectedId = item.id"
          class="w-full text-left px-3 py-3 rounded-lg border text-sm transition-all duration-200 group relative overflow-hidden"
          :class="selectedId === item.id 
            ? 'bg-bg-tertiary border-border-hover shadow-sm' 
            : 'bg-transparent border-transparent hover:bg-bg-subtle text-text-secondary hover:text-text-primary'"
        >
          <div class="flex items-start justify-between gap-2 mb-1">
             <div class="font-medium truncate leading-tight" :title="item.filePath">
               {{ item.filePath.split('/').pop() }}
             </div>
             <span class="shrink-0 text-[10px] font-mono opacity-50">{{ formatTime(item.timestamp).split(' ')[1] }}</span>
          </div>

          <div v-if="item.reason" class="mb-2 text-[11px] text-text-secondary truncate flex items-center gap-1.5 bg-bg-primary/50 py-1 px-1.5 rounded border border-border-color/50">
             <span class="text-[10px] opacity-70">📝</span>
             <span class="truncate">{{ item.reason }}</span>
          </div>
          
          <div class="flex items-center justify-between">
            <span class="text-[11px] truncate opacity-60 max-w-[70%]" :title="item.projectPath">
              {{ item.projectPath }}
            </span>
            <span class="text-[10px] px-1.5 py-0.5 rounded border capitalize font-medium"
                  :class="{
                    'bg-accent-green/10 border-accent-green/20 text-accent-green': item.type === 'resolve',
                    'bg-accent-red/10 border-accent-red/20 text-accent-red': item.type === 'delete',
                    'bg-accent-blue/10 border-accent-blue/20 text-accent-blue': item.type === 'add'
                  }">
              {{ getTypeLabel(item.type) }}
            </span>
          </div>
        </button>
      </template>
      <div v-else class="flex flex-col items-center justify-center h-48 text-text-tertiary gap-2">
        <span>すべて完了</span>
        <span class="text-2xl opacity-20">✨</span>
      </div>
    </div>
    
    <div class="p-3 border-t border-border-color bg-bg-secondary flex gap-2">
      <button @click="showSettings = true" 
              class="w-10 flex items-center justify-center py-1.5 rounded-md border border-border-color text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
              title="設定">
        ⚙
      </button>
      <button @click="loadPending" class="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md border border-border-color text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors">
        更新
      </button>
    </div>
  </aside>
</template>
