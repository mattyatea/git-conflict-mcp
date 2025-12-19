<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import ConflictList from './components/ConflictList.vue'
import ConflictHeader from './components/ConflictHeader.vue'
import ViewControls from './components/ViewControls.vue'
import CodeEditor from './components/CodeEditor.vue'
import DiffViewer from './components/DiffViewer.vue'
import SettingsModal from './components/SettingsModal.vue'
import ToastMessage from './components/ToastMessage.vue'
import { useConflicts } from './composables/useConflicts'
import { useEditorSettings } from './composables/useEditorSettings'
import { useDiff } from './composables/useDiff'

const { loadPending, selectedItem, loadConfig, isReviewMode } = useConflicts()
const { loadSettings } = useEditorSettings()
const { getViewMode } = useDiff()

let interval: NodeJS.Timeout

onMounted(() => {
  loadConfig() // Load review mode config
  loadSettings()
  loadPending()
  interval = setInterval(loadPending, 5000)
})

onUnmounted(() => {
  clearInterval(interval)
})
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-bg-primary text-text-primary font-sans">
    <!-- Sidebar -->
    <ConflictList />

    <!-- Main Content -->
    <main class="flex-1 flex flex-col min-w-0 bg-bg-primary relative">
      <template v-if="selectedItem">
        <ConflictHeader />
        
        <ViewControls />

        <!-- Content Area -->
        <div class="flex-1 overflow-auto custom-scrollbar font-mono text-[13px] leading-6 bg-bg-primary">
          <DiffViewer v-if="getViewMode() === 'diff' && selectedItem.gitDiff" />
          <CodeEditor v-else />
        </div>
      </template>

      <div v-else class="flex flex-col items-center justify-center h-full text-text-tertiary">
        <div class="w-16 h-16 rounded-xl bg-bg-secondary flex items-center justify-center text-3xl mb-4 border border-border-color">
          ←
        </div>
        <p class="font-medium text-text-secondary">確認するコンフリクトを選択してください</p>
        <p class="text-sm mt-2 opacity-60">保留中の解決リクエストがサイドバーに表示されます</p>
      </div>

      <ToastMessage />
      <SettingsModal />
    </main>
  </div>
</template>

<style>
/* Custom scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--color-bg-tertiary);
  border: 3px solid var(--color-bg-primary); /* Padding effect */
  border-radius: 99px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-tertiary);
}
</style>
