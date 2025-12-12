<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'

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
const selectedId = ref<string | null>(null)
const loading = ref(false)
const processing = ref<string | null>(null)
const toast = ref<{ message: string; type: 'success' | 'error'; show: boolean }>({
  message: '',
  type: 'success',
  show: false
})

// Correctly computed selected item
const selectedItem = computed(() => 
  pendingResolves.value.find(p => p.id === selectedId.value) || null
)

// View mode state per item
const viewModes = ref<Record<string, 'diff' | 'edit'>>({})
const editContent = ref('')
const backdropScrollTop = ref(0)

// Initialize edit content when item changes or mode changes
watch([selectedId, () => viewModes.value[selectedId.value || '']], ([newId, newMode]) => {
  if (newId && pendingResolves.value) {
    const item = pendingResolves.value.find(p => p.id === newId)
    // Default to edit mode if not set
    if (!viewModes.value[newId]) {
      viewModes.value[newId] = 'edit'
    }
    
    if (item) {
      editContent.value = item.fileContent || ''
    }
  }
})

const showOpenMenu = ref(false)
const showSettings = ref(false)
type EditorType = 'webstorm' | 'vscode' | 'cursor' | 'antigravity'
const preferredEditor = ref<EditorType | null>(null)

const editors: { id: EditorType; label: string }[] = [
  { id: 'webstorm', label: 'WebStorm' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'antigravity', label: 'AntiGravity' }
]

const loadSettings = () => {
  const saved = localStorage.getItem('gc-preferred-editor')
  if (saved && editors.some(e => e.id === saved)) {
    preferredEditor.value = saved as EditorType
  }
}

const saveSettings = (editor: EditorType) => {
  preferredEditor.value = editor
  localStorage.setItem('gc-preferred-editor', editor)
  showOpenMenu.value = false // Close menu if open
}

const openInEditor = (inputEditor?: EditorType) => {
  if (!selectedItem.value) return
  
  // Use input editor, or preferred editor, or fallback to menu
  const editor = inputEditor || preferredEditor.value
  
  if (!editor) {
    showOpenMenu.value = true
    return
  }
  
  showOpenMenu.value = false
  
  // If we are opening via specific selection (inputEditor), save it as preferred
  if (inputEditor) {
    saveSettings(inputEditor)
  }

  const path = selectedItem.value.absolutePath
  let url = ''

  switch (editor) {
    case 'webstorm':
      url = `webstorm://open?file=${path}`
      break
    case 'vscode':
      url = `vscode://file/${path}`
      break
    case 'cursor':
      url = `cursor://file/${path}`
      break
    case 'antigravity':
      url = `windsurf://file/${path}`
      break
  }
  
  if (url) {
    window.location.href = url
  }
}

const toggleView = (id: string, mode: 'diff' | 'edit') => {
  viewModes.value[id] = mode
}

const getViewMode = (item: PendingResolve) => {
  if (viewModes.value[item.id]) return viewModes.value[item.id]
  // Default to edit (formerly raw/file content)
  return 'edit'
}

const handleScroll = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  backdropScrollTop.value = target.scrollTop
}

const getTypeLabel = (type: string) => {
  switch(type) {
    case 'resolve': return '解決 (git add)'
    case 'delete': return '削除 (git rm)'
    case 'add': return '追加 (git add)'
    default: return type
  }
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('ja-JP', { 
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  })
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
    
    // Auto-select first item if nothing selected and data exists
    if (!selectedId.value && data.length > 0) {
      selectedId.value = data[0].id
    }
    // If selected item no longer exists, select first available
    if (selectedId.value && !data.find((p: PendingResolve) => p.id === selectedId.value)) {
      selectedId.value = data.length > 0 ? data[0].id : null
    }
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
      showToast('承認しました: ' + data.message)
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

// Conflict highlighting
const highlightConflicts = (content?: string) => {
  if (!content) return ''
  
  // Basic HTML escape (preserve existing functionality)
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Enhanced highlighting for Git conflicts
  // We match the standard git conflict markers and their content
  // <<<<<<< HEAD ... ======= ... >>>>>>> ...
  // Using negative margins (-mx-6) to extend background to edges while keeping text aligned (px-6)
  // matching the parent p-6 padding
  const fullWidthClass = "block w-[calc(100%+3rem)] -mx-6 px-6 box-border relative";
  
  return escaped.replace(
    /(&lt;&lt;&lt;&lt;&lt;&lt;&lt;.*?$)([\s\S]*?)(^=======.*?$)([\s\S]*?)(^&gt;&gt;&gt;&gt;&gt;&gt;&gt;.*?$)/gm,
    (match, start, ours, mid, theirs, end) => {
      // Styles for Ours (Current) - Blue theme
      // Added labels via data attributes or relative positioning would be safer, 
      // but here we simply append a label span that is absolutely positioned.
      const oursMarkerStyle = `${fullWidthClass} text-accent-blue font-bold opacity-75 bg-accent-blue/20 border-t border-accent-blue/30 pt-1`;
      const oursContentStyle = `${fullWidthClass} text-text-primary bg-accent-blue/10`; 
      const oursLabel = `<span class="absolute right-6 top-1 text-[10px] font-normal opacity-70 pointer-events-none uppercase tracking-wider">Current (HEAD)</span>`;
      
      // Styles for Theirs (Incoming) - Green theme
      const theirsMarkerStyle = `${fullWidthClass} text-accent-green font-bold opacity-75 bg-accent-green/20 border-b border-accent-green/30 pb-1`;
      const theirsContentStyle = `${fullWidthClass} text-text-primary bg-accent-green/10`;
      const theirsLabel = `<span class="absolute right-6 top-0.5 text-[10px] font-normal opacity-70 pointer-events-none uppercase tracking-wider">Incoming</span>`;

      // Middle separator style
      const midStyle = `${fullWidthClass} text-text-tertiary font-bold opacity-50 bg-bg-tertiary border-y border-border-color my-0.5`;

      // We wrap the raw text "start" in a span to keep it selectable/visible as code, 
      // but the div provides the background.
      return `<div class="${oursMarkerStyle}">${start}${oursLabel}</div>` +
             `<div class="${oursContentStyle}">${ours}</div>` +
             `<div class="${midStyle}">${mid}</div>` +
             `<div class="${theirsContentStyle}">${theirs}</div>` +
             `<div class="${theirsMarkerStyle}">${end}${theirsLabel}</div>`;
    }
  );
}

const saveContent = async (id: string, content: string) => {
  if (!content) return
  processing.value = id
  
  try {
    const res = await fetch('/api/save/' + id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })
    const data = await res.json()
    
    if (data.success) {
      showToast('保存しました')
      await loadPending() // Refresh data
    } else {
      showToast('エラー: ' + data.error, 'error')
    }
  } catch (e) {
    showToast('保存に失敗しました', 'error')
  } finally {
    processing.value = null
  }
}

// Helpers for Diff View Editing
const getLineContent = (lineNum?: number) => {
  if (!lineNum) return ''
  const lines = editContent.value.split('\n')
  return lines[lineNum - 1] || ''
}

const updateLineContent = (lineNum: number | undefined, text: string) => {
  if (!lineNum) return
  const lines = editContent.value.split('\n')
  // Ensure line exists (handle edge case where file is shorter than diff expects)
  if (lineNum >= 1 && lineNum <= lines.length + 1) {
    // If appending (rare case in this simplified view), handle splice
    lines[lineNum - 1] = text
    editContent.value = lines.join('\n')
  }
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
  const isCombined = lines.some(l => l.startsWith('diff --cc') || l.startsWith('@@@'))
  
  const parsedLines: DiffLine[] = []
  let additions = 0
  let deletions = 0
  let lineNumber = 0

  lines.forEach((line, index) => {
    let type: DiffLine['type'] = 'context'
    let displayLineNum = ''
    let content = line

    if (line.startsWith('diff --git') || line.startsWith('diff --cc') || line.startsWith('index ') || 
        line.startsWith('---') || line.startsWith('+++')) {
      type = 'header'
    } else if (line.startsWith('@@')) {
      type = 'hunk'
      const match = isCombined 
        ? line.match(/\+(\d+)/g) // Simplified match for combined, takes last +number
        : line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)/)
      
      if (match) {
        // For combined, we take the last match which usually corresponds to the merge result line number
        const val = isCombined && match ? match[match.length - 1] : (match ? match[3] : null)
        if (val) {
          lineNumber = parseInt(val.replace('+', '')) - 1
        }
      }
    } else if (isCombined) {
       const prefix = line.substring(0, 2)
       if (prefix === '++' || prefix === '+ ' || prefix === ' +') {
         type = 'addition'
         additions++
         lineNumber++
         displayLineNum = lineNumber.toString()
         content = line.substring(2)
       } else if (prefix === '--' || prefix === '- ' || prefix === ' -') {
         type = 'deletion'
         deletions++
         displayLineNum = ''
         content = line.substring(2)
       } else {
         type = 'context'
         lineNumber++
         displayLineNum = lineNumber.toString()
         content = line.substring(2)
       }
    } else {
       if (line.startsWith('+') && !line.startsWith('+++')) {
         type = 'addition'
         additions++
         lineNumber++
         displayLineNum = lineNumber.toString()
         content = line.substring(1)
       } else if (line.startsWith('-') && !line.startsWith('---')) {
         type = 'deletion'
         deletions++
         displayLineNum = ''
         content = line.substring(1)
       } else if (line.trim() !== '' || index < lines.length - 1) {
         type = 'context'
         lineNumber++
         displayLineNum = lineNumber.toString()
         if (line.startsWith(' ')) content = line.substring(1)
       }
    }

    parsedLines.push({
      type,
      content,
      lineNum: lineNumber,
      displayLineNum
    })
  })

  return { stats: { additions, deletions }, lines: parsedLines }
}

let interval: NodeJS.Timeout

onMounted(() => {
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
    <!-- Sidebar: List of Conflicts -->
    <aside class="w-80 min-w-[320px] flex flex-col border-r border-border-color bg-bg-secondary">
      <header class="h-16 flex items-center justify-between px-5 border-b border-border-color bg-bg-secondary sticky top-0 z-10">
        <div class="flex items-center gap-2.5">
          <div class="w-6 h-6 rounded bg-accent-primary text-bg-primary flex items-center justify-center font-bold text-xs">
            GC
          </div>
          <h1 class="font-medium text-sm tracking-tight text-text-primary">解決待ち一覧</h1>
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

    <!-- Main Content: Detail View -->
    <main class="flex-1 flex flex-col min-w-0 bg-bg-primary relative">
      <div v-if="selectedItem" class="flex flex-col h-full">
        <!-- Detail Header -->
        <header class="h-16 flex items-center justify-between px-6 border-b border-border-color bg-bg-primary shrink-0">
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
                 <button @click="openInEditor()"
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
                         @click="openInEditor(editor.id)" 
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

        <!-- View Controls & Diff Stats -->
        <div class="px-6 py-3 border-b border-border-color flex items-center justify-between bg-bg-subtle shrink-0">
          <div class="flex items-center p-1 bg-bg-primary border border-border-color rounded-lg">
            <button @click="toggleView(selectedItem.id, 'edit')"
                    class="px-3 py-1 rounded-md text-xs font-medium transition-all"
                    :class="getViewMode(selectedItem) === 'edit' ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'">
              エディタ
            </button>
            <button @click="toggleView(selectedItem.id, 'diff')"
                    class="px-3 py-1 rounded-md text-xs font-medium transition-all"
                    :class="getViewMode(selectedItem) === 'diff' ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'">
              差分表示
            </button>
          </div>
          
          <div v-if="getViewMode(selectedItem) === 'edit'" class="flex gap-2">
             <button @click="saveContent(selectedItem.id, editContent)" 
                     :disabled="!!processing"
                     class="px-3 py-1 rounded-md text-xs font-medium bg-accent-primary text-bg-primary hover:bg-white/90 transition-colors disabled:opacity-50">
               保存
             </button>
          </div>          
          <div v-if="getViewMode(selectedItem) === 'diff' && selectedItem.gitDiff" class="flex gap-4 text-xs font-mono">
            <span class="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-primary border border-border-color text-accent-green">
              <strong>+{{ parseDiff(selectedItem.gitDiff!).stats.additions }}</strong>
            </span>
            <span class="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-primary border border-border-color text-accent-red">
              <strong>-{{ parseDiff(selectedItem.gitDiff!).stats.deletions }}</strong>
            </span>
          </div>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-auto custom-scrollbar font-mono text-[13px] leading-6 bg-bg-primary">
          <template v-if="getViewMode(selectedItem) === 'diff' && selectedItem.gitDiff">
            <div class="w-full pb-10">
              <div v-for="(line, idx) in parseDiff(selectedItem.gitDiff!).lines" :key="idx"
                   class="flex min-h-[1.5em] group/line hover:bg-bg-tertiary/30"
                   :class="{
                     'bg-accent-green/10': line.type === 'addition',
                     'bg-accent-red/10': line.type === 'deletion',
                     'bg-bg-tertiary text-text-secondary border-y border-border-color/50 py-2': line.type === 'hunk',
                     'bg-bg-tertiary border-b border-border-color py-1': line.type === 'header'
                   }">
                <template v-if="line.type !== 'header' && line.type !== 'hunk'">
                  <div class="w-[50px] shrink-0 text-right px-3 text-text-tertiary/50 select-none border-r border-border-color/30 group-hover/line:text-text-tertiary text-xs bg-bg-subtle/30 leading-[1.6]">
                     {{ line.displayLineNum }}
                  </div>
                  <div class="flex-1 px-4 whitespace-pre-wrap break-all relative flex items-center">
                    <span v-if="line.type === 'addition'" class="absolute left-1.5 text-accent-green opacity-50 select-none">+</span>
                    <span v-else-if="line.type === 'deletion'" class="absolute left-1.5 text-accent-red opacity-50 select-none">-</span>
                    
                    <!-- Editable Content for Context and Addition -->
                    <template v-if="line.type !== 'deletion'">
                      <input
                        type="text"
                        :value="getLineContent(line.lineNum)"
                        @input="(e) => updateLineContent(line.lineNum, (e.target as HTMLInputElement).value)"
                        class="w-full bg-transparent border-none outline-none font-mono text-[13px] p-0 m-0 leading-[1.6] text-inherit focus:ring-0"
                        :class="{
                          'text-accent-green': line.type === 'addition',
                          'text-text-tertiary': line.type === 'context',
                          'text-text-primary': line.type === 'context' // Override tertiary on focus? No, context is code.
                        }"
                        spellcheck="false"
                      />
                    </template>
                    
                    <!-- Read-only Content for Deletion -->
                    <span v-else class="text-accent-red">{{ line.content }}</span>
                  </div>
                </template>
                <template v-else>
                   <div class="w-full px-4 text-xs opacity-70">
                     {{ line.content }}
                   </div>
                </template>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="relative h-full w-full flex-1 overflow-hidden bg-bg-primary">
              <!-- Backdrop for highlighting -->
              <div class="absolute inset-0 pointer-events-none p-6 font-mono text-[13px] leading-6 whitespace-pre-wrap break-all overflow-hidden z-0"
                   :scrollTop="backdropScrollTop"
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
          </template>
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center h-full text-text-tertiary">
        <div class="w-16 h-16 rounded-xl bg-bg-secondary flex items-center justify-center text-3xl mb-4 border border-border-color">
          ←
        </div>
        <p class="font-medium text-text-secondary">確認するコンフリクトを選択してください</p>
        <p class="text-sm mt-2 opacity-60">保留中の解決リクエストがサイドバーに表示されます</p>
      </div>

      <!-- Toast -->
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

      <!-- Settings Modal -->
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
