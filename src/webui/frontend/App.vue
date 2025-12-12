<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface PendingResolve {
  id: string;
  filePath: string;
  absolutePath: string;
  projectPath: string;
  type: "resolve" | "delete" | "add";
  fileContent?: string;
  gitDiff?: string;
  timestamp: number;
}

const pendingResolves = ref<PendingResolve[]>([])
const loading = ref(false)
const processing = ref<string | null>(null)
const toast = ref<{ message: string; type: 'success' | 'error'; show: boolean }>({
  message: '',
  type: 'success',
  show: false
})

const getTypeLabel = (type: string) => {
  switch(type) {
    case 'resolve': return 'Resolve (git add)'
    case 'delete': return 'Delete (git rm)'
    case 'add': return 'Add (git add)'
    default: return type
  }
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('ja-JP')
}

const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  toast.value = { message, type, show: true }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

const loadPending = async () => {
  try {
    const res = await fetch('/api/pending')
    const data = await res.json()
    pendingResolves.value = data
  } catch (e) {
    console.error('Failed to load pending:', e)
  }
}

const approveResolve = async (id: string) => {
  processing.value = id
  try {
    const res = await fetch('/api/approve/' + id, { method: 'POST' })
    const data = await res.json()
    
    if (data.success) {
      showToast('解決を実行しました: ' + data.message)
      await loadPending()
    } else {
      showToast('エラー: ' + data.error, 'error')
    }
  } catch (e) {
    showToast('リクエストに失敗しました', 'error')
  } finally {
    processing.value = null
  }
}

const rejectResolve = async (id: string) => {
  processing.value = id
  try {
    const res = await fetch('/api/reject/' + id, { method: 'POST' })
    const data = await res.json()
    
    if (data.success) {
      showToast('解決を拒否しました')
      await loadPending()
    } else {
      showToast('エラー: ' + data.error, 'error')
    }
  } catch (e) {
    showToast('リクエストに失敗しました', 'error')
  } finally {
    processing.value = null
  }
}

// View mode state per item
const viewModes = ref<Record<string, 'diff' | 'raw'>>({})

const toggleView = (id: string, mode: 'diff' | 'raw') => {
  viewModes.value[id] = mode
}

const getViewMode = (item: PendingResolve) => {
  if (viewModes.value[item.id]) return viewModes.value[item.id]
  return item.gitDiff ? 'diff' : 'raw'
}

// Conflict highlighting
const highlightConflicts = (content?: string) => {
  if (!content) return '<span class="text-text-secondary">（ファイルが存在しないか読み取れません）</span>'
  
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^(&lt;&lt;&lt;&lt;&lt;&lt;&lt;.*$)/gm, '<span class="text-accent-yellow font-bold">$1</span>')
    .replace(/^(=======)$/gm, '<span class="text-accent-yellow font-bold">$1</span>')
    .replace(/^(&gt;&gt;&gt;&gt;&gt;&gt;&gt;.*$)/gm, '<span class="text-accent-yellow font-bold">$1</span>')
}

// Diff parsing
interface DiffLine {
  type: 'header' | 'hunk' | 'addition' | 'deletion' | 'context';
  content: string;
  lineNum?: number;
  displayLineNum: string;
}

const parseDiff = (diffText: string): { stats: { additions: number, deletions: number }, lines: DiffLine[] } => {
  if (!diffText || diffText.trim() === '') return { stats: { additions: 0, deletions: 0 }, lines: [] }

  const lines = diffText.split('\n')
  const parsedLines: DiffLine[] = []
  let additions = 0
  let deletions = 0
  let lineNumber = 0

  lines.forEach((line, index) => {
    let type: DiffLine['type'] = 'context'
    let displayLineNum = ''

    if (line.startsWith('diff --git') || line.startsWith('index ') || 
        line.startsWith('---') || line.startsWith('+++')) {
      type = 'header'
    } else if (line.startsWith('@@')) {
      type = 'hunk'
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)/)
      if (match) {
        lineNumber = parseInt(match[3]) - 1
      }
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      type = 'addition'
      additions++
      lineNumber++
      displayLineNum = lineNumber.toString()
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      type = 'deletion'
      deletions++
      displayLineNum = ''
    } else if (line.trim() !== '' || index < lines.length - 1) {
      type = 'context'
      lineNumber++
      displayLineNum = lineNumber.toString()
    }

    parsedLines.push({
      type,
      content: line,
      lineNum: lineNumber,
      displayLineNum
    })
  })

  return { stats: { additions, deletions }, lines: parsedLines }
}

let interval: NodeJS.Timeout

onMounted(() => {
  loadPending()
  interval = setInterval(loadPending, 5000)
})

onUnmounted(() => {
  clearInterval(interval)
})
</script>

<template>
  <div class="min-h-screen bg-bg-primary text-text-primary font-sans">
    <header class="sticky top-0 z-50 bg-bg-secondary border-b border-border-color backdrop-blur-md bg-opacity-90 px-8 py-6">
      <div class="max-w-[1400px] mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-green to-[#2ea043] flex items-center justify-center text-xl">
            🔀
          </div>
          <h1 class="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-br from-text-primary to-accent-blue">
            Conflict Resolution
          </h1>
        </div>
        <div class="flex items-center gap-4">
          <button @click="loadPending" class="flex items-center gap-2 px-4 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm hover:bg-border-color transition-colors">
            🔄 更新
          </button>
          <div class="flex items-center gap-2 px-4 py-2 bg-bg-tertiary rounded-full text-sm text-text-secondary">
            <span class="w-2 h-2 rounded-full bg-accent-green animate-pulse"></span>
            <span>{{ pendingResolves.length }}</span> 件の確認待ち
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-[1400px] mx-auto p-8">
      <div v-if="pendingResolves.length === 0" class="text-center py-24 text-text-secondary">
        <div class="text-6xl mb-6 opacity-50">✅</div>
        <h2 class="text-2xl font-medium mb-2 text-text-primary">確認待ちの解決はありません</h2>
        <p>新しい解決リクエストが来ると、ここに表示されます</p>
      </div>

      <div v-else>
        <h2 class="text-lg font-semibold mb-6 text-text-secondary">確認待ちの解決リクエスト</h2>
        <div class="flex flex-col gap-6">
          <div v-for="item in pendingResolves" :key="item.id" 
               class="bg-bg-secondary border border-border-color rounded-2xl overflow-hidden shadow-lg hover:-translate-y-0.5 hover:shadow-2xl transition-all duration-200"
               :class="{ 'opacity-50 pointer-events-none': processing === item.id }">
            
            <div class="flex items-center justify-between px-6 py-5 bg-bg-tertiary border-b border-border-color">
              <div class="flex items-center gap-4">
                <div class="w-[42px] h-[42px] rounded-xl bg-accent-blue/15 flex items-center justify-center text-xl">
                  📄
                </div>
                <div>
                  <h3 class="text-base font-semibold font-mono text-accent-blue">{{ item.filePath }}</h3>
                  <div class="text-xs text-text-secondary mt-1">{{ item.projectPath }}</div>
                </div>
              </div>
              <span class="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide"
                    :class="{
                      'bg-accent-green/15 text-accent-green': item.type === 'resolve',
                      'bg-accent-red/15 text-accent-red': item.type === 'delete',
                      'bg-accent-blue/15 text-accent-blue': item.type === 'add'
                    }">
                {{ getTypeLabel(item.type) }}
              </span>
            </div>

            <div class="p-6">
              <div class="flex gap-2 mb-4">
                <button @click="toggleView(item.id, 'diff')"
                        class="px-4 py-2 rounded-md text-xs border transition-colors duration-200"
                        :class="getViewMode(item) === 'diff' 
                          ? 'bg-accent-blue border-accent-blue text-white' 
                          : 'bg-bg-tertiary border-border-color text-text-secondary hover:bg-border-color'">
                  📊 差分表示
                </button>
                <button @click="toggleView(item.id, 'raw')"
                        class="px-4 py-2 rounded-md text-xs border transition-colors duration-200"
                        :class="getViewMode(item) === 'raw'
                          ? 'bg-accent-blue border-accent-blue text-white'
                          : 'bg-bg-tertiary border-border-color text-text-secondary hover:bg-border-color'">
                  📄 ファイル内容
                </button>
              </div>

              <div class="bg-bg-primary border border-border-color rounded-xl overflow-auto max-h-[500px] font-mono text-[13px] leading-relaxed">
                <template v-if="getViewMode(item) === 'diff' && item.gitDiff">
                  <div class="w-full">
                    <div class="flex gap-4 px-4 py-3 bg-bg-tertiary border-b border-border-color text-sm sticky top-0">
                      <span class="text-accent-green">+{{ parseDiff(item.gitDiff!).stats.additions }} 追加</span>
                      <span class="text-accent-red">-{{ parseDiff(item.gitDiff!).stats.deletions }} 削除</span>
                    </div>
                    <div v-for="(line, idx) in parseDiff(item.gitDiff!).lines" :key="idx"
                         class="flex min-h-[1.75em]"
                         :class="{
                           'bg-[#2ea04333]': line.type === 'addition',
                           'bg-[#f8514933]': line.type === 'deletion',
                           'bg-accent-blue/10 text-accent-blue font-medium': line.type === 'header',
                           'bg-[#8e57ff33] text-[#a371f7]': line.type === 'hunk'
                         }">
                      <span class="w-[50px] min-w-[50px] px-2 text-right text-text-secondary bg-bg-secondary border-r border-border-color text-xs flex items-center justify-end select-none"
                            :class="{
                              'bg-[#2ea0434d] text-accent-green': line.type === 'addition',
                              'bg-[#f851494d] text-accent-red': line.type === 'deletion',
                              'bg-accent-blue/15': line.type === 'header',
                              'bg-[#8e57ff33]': line.type === 'hunk'
                            }">
                        {{ line.displayLineNum }}
                      </span>
                      <span class="flex-1 px-3 whitespace-pre-wrap break-all py-0.5">
                        <span v-if="line.type === 'addition'" class="text-accent-green font-bold mr-2 select-none">+</span>
                        <span v-else-if="line.type === 'deletion'" class="text-accent-red font-bold mr-2 select-none">-</span>
                        <span v-else-if="line.type === 'context'" class="mr-2 select-none"> </span>
                        <span>{{ line.type === 'addition' || line.type === 'deletion' ? line.content.substring(1) : line.content }}</span>
                      </span>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="p-4 whitespace-pre-wrap break-all" v-html="highlightConflicts(item.fileContent)"></div>
                </template>
              </div>
              
              <div class="text-xs text-text-secondary mt-2">
                リクエスト時刻: {{ formatTime(item.timestamp) }}
              </div>
            </div>

            <div class="flex gap-4 px-6 py-5 bg-bg-tertiary border-t border-border-color">
              <button @click="rejectResolve(item.id)" :disabled="!!processing"
                      class="flex-1 py-3.5 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all duration-200 border bg-bg-primary text-accent-red border-accent-red hover:bg-accent-red/10 disabled:opacity-50 disabled:cursor-not-allowed">
                ❌ 拒否
              </button>
              <button @click="approveResolve(item.id)" :disabled="!!processing"
                      class="flex-1 py-3.5 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all duration-200 text-white bg-gradient-to-br from-accent-green to-[#2ea043] hover:-translate-y-[1px] hover:shadow-[0_4px_20px_rgba(63,185,80,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
                ✅ 解決を実行
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div class="fixed bottom-8 right-8 px-6 py-4 rounded-xl font-medium shadow-2xl transition-all duration-300 transform z-[1000]"
         :class="[
           toast.show ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0',
           toast.type === 'success' ? 'bg-accent-green text-white' : 'bg-accent-red text-white'
         ]">
      {{ toast.message }}
    </div>
  </div>
</template>

<style>
/* Global scrollbar styling if needed, though Tailwind hides most of it */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: var(--color-bg-primary);
}
::-webkit-scrollbar-thumb {
  background: var(--color-border-color);
  border-radius: 5px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-secondary);
}
</style>
