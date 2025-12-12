import { ref, watch, type Ref } from 'vue'
import hljs from 'highlight.js';
import { useConflicts } from './useConflicts';

export interface DiffLine {
    type: 'header' | 'hunk' | 'addition' | 'deletion' | 'context';
    content: string;
    lineNum?: number;
    displayLineNum: string;
}

const viewModes = ref<Record<string, 'diff' | 'edit'>>({})
const editContent = ref('')

export function useDiff() {
    const { selectedItem } = useConflicts()

    // Watch for selection changes to update edit content and default view mode
    watch(() => selectedItem.value, (newItem) => {
        if (newItem) {
            const id = newItem.id
            if (!viewModes.value[id]) {
                viewModes.value[id] = 'edit'
            }
            // Only update edit content if it seems we switched items or it is empty
            // But we need to be careful not to overwrite unsaved changes if we switch back and forth?
            // The original code reset editContent whenever selectedId changed.
            editContent.value = newItem.fileContent || ''
        } else {
            editContent.value = ''
        }
    }, { immediate: true })

    const toggleView = (mode: 'diff' | 'edit') => {
        if (selectedItem.value) {
            viewModes.value[selectedItem.value.id] = mode
        }
    }

    const getViewMode = () => {
        if (selectedItem.value && viewModes.value[selectedItem.value.id]) {
            return viewModes.value[selectedItem.value.id]
        }
        return 'edit'
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

    const highlightCode = (text: string) => {
        if (!text) return '';
        let language = 'plaintext';
        if (selectedItem.value) {
            const ext = selectedItem.value.filePath.split('.').pop()?.toLowerCase();
            if (ext && hljs.getLanguage(ext)) {
                language = ext;
            }
        }
        try {
            return hljs.highlight(text, { language }).value;
        } catch (e) {
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
    }

    const highlightConflicts = (content?: string) => {
        if (!content) return ''

        // Use the shared highlight function, but we need raw text helper for manual construction sometimes?
        // Actually highlightCode does exactly what 'h' did, mostly.
        const h = highlightCode;

        const fullWidthClass = "block w-[calc(100%+3rem)] -mx-6 px-6 box-border relative";

        const regex = /(<<<<<<<.*?$)([\s\S]*?)(^=======.*?$)([\s\S]*?)(^>>>>>>>.*?$)/gm;

        let lastIndex = 0;
        let html = '';
        let match;

        while ((match = regex.exec(content)) !== null) {
            const [fullMatch, startMarker, ours, midMarker, theirs, endMarker] = match;
            const index = match.index;

            // Highlight context before conflict
            if (index > lastIndex) {
                html += h(content.substring(lastIndex, index));
            }

            // Styles
            const oursMarkerStyle = `${fullWidthClass} text-accent-blue font-bold opacity-75 bg-accent-blue/20 shadow-[inset_0_1px_0_0_rgba(59,130,246,0.3)]`;
            const oursContentStyle = `${fullWidthClass} text-text-primary bg-accent-blue/10`;
            const oursLabel = `<span class="absolute right-6 top-0 text-[10px] font-normal opacity-70 pointer-events-none uppercase tracking-wider leading-6">Current (HEAD)</span>`;

            const midStyle = `${fullWidthClass} text-text-tertiary font-bold opacity-50 bg-bg-tertiary shadow-[inset_0_1px_0_0_rgba(39,39,42,1),inset_0_-1px_0_0_rgba(39,39,42,1)]`;

            const theirsMarkerStyle = `${fullWidthClass} text-accent-green font-bold opacity-75 bg-accent-green/20 shadow-[inset_0_-1px_0_0_rgba(34,197,94,0.3)]`;
            const theirsContentStyle = `${fullWidthClass} text-text-primary bg-accent-green/10`;
            const theirsLabel = `<span class="absolute right-6 top-0 text-[10px] font-normal opacity-70 pointer-events-none uppercase tracking-wider leading-6">Incoming</span>`;

            // Append conflict block
            html += `<div class="${oursMarkerStyle}">${h(startMarker)}${oursLabel}</div>` +
                `<div class="${oursContentStyle}">${h(ours)}</div>` +
                `<div class="${midStyle}">${h(midMarker)}</div>` +
                `<div class="${theirsContentStyle}">${h(theirs)}</div>` +
                `<div class="${theirsMarkerStyle}">${h(endMarker)}${theirsLabel}</div>`;

            lastIndex = regex.lastIndex;
        }

        // Highlight remaining text
        if (lastIndex < content.length) {
            html += h(content.substring(lastIndex));
        }

        return html;
    }

    const getLineContent = (lineNum?: number) => {
        if (!lineNum) return ''
        const lines = editContent.value.split('\n')
        return lines[lineNum - 1] || ''
    }

    const updateLineContent = (lineNum: number | undefined, text: string) => {
        if (!lineNum) return
        const lines = editContent.value.split('\n')
        // Ensure line exists
        if (lineNum >= 1 && lineNum <= lines.length + 1) {
            lines[lineNum - 1] = text
            editContent.value = lines.join('\n')
        }
    }

    const getFirstConflictLine = () => {
        if (!selectedItem.value?.fileContent) return 1
        const lines = selectedItem.value.fileContent.split('\n')
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('<<<<<<<')) {
                return i + 1
            }
        }
        return 1
    }

    return {
        viewModes,
        editContent,
        toggleView,
        getViewMode,
        parseDiff,
        highlightConflicts,
        highlightCode,
        getLineContent,
        updateLineContent,
        getFirstConflictLine
    }
}
