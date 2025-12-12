<script setup lang="ts">
import { useConflicts } from '../composables/useConflicts'
import { useEditorSettings } from '../composables/useEditorSettings'
import { useDiff } from '../composables/useDiff'

const { 
  selectedItem, 
  approveResolve, 
  rejectResolve, 
  processing, 
  getTypeLabel 
} = useConflicts()

const { 
  preferredEditor, 
  editors, 
  openInEditor, 
  showOpenMenu, 
  showSettings 
} = useEditorSettings()

const { getFirstConflictLine } = useDiff()
</script>

<template>
  <header v-if="selectedItem" class="h-16 flex items-center justify-between px-6 border-b border-border-color bg-bg-primary shrink-0">
     <div class="flex items-center gap-4 overflow-hidden">
       <div class="p-2 rounded bg-bg-tertiary border border-border-color text-xl">
         📄
       </div>
       <div class="min-w-0">
         <div class="text-[10px] text-text-tertiary font-mono uppercase tracking-wider mb-0.5">
           {{ getTypeLabel(selectedItem.type) }} リクエスト
         </div>
         <div class="text-base font-medium truncate font-mono text-text-primary select-all" :title="selectedItem.filePath">
           {{ selectedItem.filePath }}
         </div>
       </div>
     </div>

     <div class="flex items-center gap-2 shrink-0">
       <!-- Open in IDE -->
       <div class="relative group">
         <div class="flex items-center rounded-md border border-transparent hover:border-border-color overflow-hidden transition-colors"
              :class="preferredEditor ? 'bg-bg-tertiary border-border-color' : ''">
           
           <!-- Main Button -->
           <button @click="openInEditor(selectedItem.absolutePath, undefined, getFirstConflictLine())"
                   :title="preferredEditor ? `${editors.find(e => e.id === preferredEditor)?.label}で開く` : 'エディタで開く'"
                   class="px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors"
                   :class="!preferredEditor ? 'hover:bg-bg-tertiary rounded-md' : 'pr-2'">
             <span class="text-xs">↗</span>
             <span>{{ preferredEditor ? editors.find(e => e.id === preferredEditor)?.label : 'IDE' }}</span>
           </button>

           <!-- Dropdown Trigger (only visible if preferred editor is set) -->
           <button v-if="preferredEditor"
                   @click="showOpenMenu = !showOpenMenu"
                   class="px-1.5 py-2 border-l border-border-color/50 text-text-secondary hover:text-text-primary hover:bg-black/5 active:bg-black/10 transition-colors">
             <span class="text-[10px]">▼</span>
           </button>
         </div>
         
         <!-- Backdrop -->
         <div v-if="showOpenMenu" class="fixed inset-0 z-[55]" @click="showOpenMenu = false"></div>

         <!-- Dropdown -->
         <div v-if="showOpenMenu" 
              @click="showOpenMenu = false"
              class="absolute right-0 top-full mt-2 w-48 bg-bg-primary border border-border-color rounded-lg shadow-xl py-1 z-[60] overflow-hidden">
           <div class="px-3 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider border-b border-border-color mb-1">
             エディタを選択
           </div>
           <button v-for="editor in editors" 
                   :key="editor.id"
                   @click="openInEditor(selectedItem.absolutePath, editor.id, getFirstConflictLine())" 
                   class="w-full text-left px-4 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors flex items-center justify-between group/item">
             <span>{{ editor.label }}で開く</span>
             <span v-if="preferredEditor === editor.id" class="text-accent-primary">✓</span>
           </button>
           <div class="h-px bg-border-color my-1"></div>
           <button @click="showSettings = true" class="w-full text-left px-4 py-2 text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
             設定...
           </button>
         </div>
       </div>

       <button @click="rejectResolve(selectedItem.id)" 
               :disabled="!!processing"
               class="px-4 py-2 rounded-md text-sm font-medium text-accent-red hover:bg-accent-red/10 border border-transparent hover:border-accent-red/20 transition-colors disabled:opacity-50">
         拒否
       </button>
       <button @click="approveResolve(selectedItem.id)" 
               :disabled="!!processing"
               class="px-5 py-2 rounded-md text-sm font-medium bg-text-primary text-bg-primary hover:bg-white/90 border border-transparent shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2">
         <span v-if="processing === selectedItem.id" class="animate-spin text-xs">⌛</span>
         解決を承認
       </button>
     </div>
  </header>
</template>
