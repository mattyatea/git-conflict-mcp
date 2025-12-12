<script setup lang="ts">
import { useConflicts } from '../composables/useConflicts'
import { useDiff } from '../composables/useDiff'

const { selectedItem } = useConflicts()
const { parseDiff, getLineContent, updateLineContent } = useDiff()
</script>

<template>
  <div v-if="selectedItem && selectedItem.gitDiff" class="w-full pb-10 font-mono text-[13px] leading-6 bg-bg-primary">
    <div v-for="(line, idx) in parseDiff(selectedItem.gitDiff).lines" :key="idx"
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
