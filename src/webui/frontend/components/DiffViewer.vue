<script setup lang="ts">
import { useConflicts } from '../composables/useConflicts'
import { useDiff } from '../composables/useDiff'

const { selectedItem } = useConflicts()
const { parseDiff, getLineContent, updateLineContent, highlightCode } = useDiff()
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
        <div class="flex-1 px-4 whitespace-pre relative flex items-center min-w-0">
          <span v-if="line.type === 'addition'" class="absolute left-1.5 text-accent-green opacity-50 select-none">+</span>
          <span v-else-if="line.type === 'deletion'" class="absolute left-1.5 text-accent-red opacity-50 select-none">-</span>
          
          <!-- Editable Content for Context and Addition -->
          <template v-if="line.type !== 'deletion'">
             <div class="relative w-full">
                <!-- Highlighted Background -->
                <div class="absolute inset-0 pointer-events-none select-none overflow-hidden whitespace-pre"
                     v-html="highlightCode(getLineContent(line.lineNum))">
                </div>
                <!-- Input -->
                <input
                  type="text"
                  :value="getLineContent(line.lineNum)"
                  @input="(e) => updateLineContent(line.lineNum, (e.target as HTMLInputElement).value)"
                  class="relative z-10 w-full bg-transparent border-none outline-none font-mono text-[13px] p-0 m-0 leading-[1.6] text-transparent caret-text-primary focus:ring-0 whitespace-pre"
                  spellcheck="false"
                />
             </div>
          </template>
          
          <!-- Read-only Content for Deletion -->
          <span v-else class="whitespace-pre w-full" v-html="highlightCode(line.content)"></span>
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
