<script setup lang="ts">
import { useEditorSettings } from '../composables/useEditorSettings'

const { showSettings, preferredEditor, editors, saveSettings } = useEditorSettings()
</script>

<template>
  <div v-if="showSettings" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showSettings = false"></div>
    <div class="bg-bg-secondary w-full max-w-sm rounded-xl border border-border-color shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
      <header class="px-5 py-4 border-b border-border-color flex items-center justify-between bg-bg-secondary">
        <h2 class="font-medium text-text-primary">設定</h2>
        <button @click="showSettings = false" class="text-text-tertiary hover:text-text-primary transition-colors">
          ✕
        </button>
      </header>
      
      <div class="p-5 overflow-y-auto">
        <div class="space-y-4">
          <div>
            <label class="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 block">デフォルトエディタ</label>
            <div class="space-y-1">
              <label v-for="editor in editors" 
                     :key="editor.id"
                     class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all"
                     :class="preferredEditor === editor.id 
                       ? 'bg-accent-primary/5 border-accent-primary text-accent-primary shadow-sm' 
                       : 'bg-bg-primary border-transparent hover:bg-bg-tertiary text-text-secondary hover:text-text-primary'">
                <span class="text-sm font-medium">{{ editor.label }}</span>
                <input type="radio" 
                       name="editor" 
                       :value="editor.id" 
                       :checked="preferredEditor === editor.id"
                       @change="saveSettings(editor.id)"
                       class="accent-accent-primary w-4 h-4">
              </label>
            </div>
            <p class="text-[11px] text-text-tertiary mt-2 leading-relaxed">
              ファイルを開く際に使用するエディタを選択します。<br>
              これはブラウザのローカルストレージに保存されます。
            </p>
          </div>
        </div>
      </div>
      
      <div class="p-4 bg-bg-tertiary border-t border-border-color flex justify-end">
        <button @click="showSettings = false" class="px-4 py-2 bg-text-primary text-bg-primary rounded-lg text-sm font-medium hover:bg-white/90 transition-colors">
          完了
        </button>
      </div>
    </div>
  </div>
</template>
