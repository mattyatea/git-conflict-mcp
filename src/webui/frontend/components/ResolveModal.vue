<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  filePath: string
  initialComment?: string
  title?: string
  confirmText?: string
  isReject?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', comment: string): void
}>()
const comment = ref('')

watch(() => props.show, (newVal) => {
  if (newVal) {
    comment.value = props.initialComment || ''
  }
})

const confirm = () => {
  emit('confirm', comment.value)
}
</script>
<template>
  <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')"></div>
    <div class="bg-bg-secondary w-full max-w-lg rounded-xl border border-border-color shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
      <header class="px-5 py-4 border-b border-border-color flex items-center justify-between bg-bg-secondary">
        <h2 class="font-medium text-text-primary">{{ title || '解決の承認' }}</h2>
        <button @click="$emit('close')" class="text-text-tertiary hover:text-text-primary transition-colors">
          ✕
        </button>
      </header>
      
      <div class="p-5 overflow-y-auto">
        <div class="space-y-4">
          <div>
            <p class="text-text-secondary text-sm mb-4 leading-relaxed">
              <span class="font-mono text-text-primary bg-bg-tertiary px-1.5 py-0.5 rounded break-all">{{ filePath }}</span> 
              {{ isReject ? 'の変更を拒否します。' : 'の変更を承認します。' }}<br>
              {{ isReject ? '拒否する理由をコメントとして入力してください。' : 'この変更の妥当性についてコメントを入力してください。' }}
            </p>
            
            <textarea 
              v-model="comment"
              class="w-full h-32 bg-bg-primary border border-border-color rounded-lg p-3 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary text-sm resize-none transition-all"
              :placeholder="isReject ? '例: この変更は誤っています。正しくは...' : '例: mainブランチの変更を取り込み、変数を修正しました...'"
              autofocus
            ></textarea>
            
            <p class="text-[11px] text-text-tertiary mt-2">
              ※ コメントは任意ですが、記録のために推奨されます。
            </p>
          </div>
        </div>
      </div>
      
      <div class="p-4 bg-bg-tertiary border-t border-border-color flex justify-end gap-3">
        <button 
          @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          キャンセル
        </button>
        <button 
          @click="confirm"
          class="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/90 transition-colors shadow-sm"
          :class="isReject ? 'bg-accent-red text-white hover:bg-accent-red/90' : 'bg-text-primary text-bg-primary'"
        >
          {{ confirmText || '承認して完了' }}
        </button>
      </div>
    </div>
  </div>
</template>
