import { ref } from 'vue'

export type EditorType = 'webstorm' | 'vscode' | 'cursor' | 'antigravity'

export interface EditorOption {
    id: EditorType
    label: string
}

export const editors: EditorOption[] = [
    { id: 'webstorm', label: 'WebStorm' },
    { id: 'vscode', label: 'VS Code' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'antigravity', label: 'AntiGravity' }
]

export function useEditorSettings() {
    const showOpenMenu = ref(false)
    const showSettings = ref(false)
    const preferredEditor = ref<EditorType | null>(null)

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

    const openInEditor = (path: string, inputEditor?: EditorType, line?: number) => {
        // Use input editor, or preferred editor, or fallback to menu return false to indicate menu should open
        const editor = inputEditor || preferredEditor.value

        if (!editor) {
            showOpenMenu.value = true
            return false
        }

        showOpenMenu.value = false

        // If we are opening via specific selection (inputEditor), save it as preferred
        if (inputEditor) {
            saveSettings(inputEditor)
        }

        let url = ''

        switch (editor) {
            case 'webstorm':
                url = `webstorm://open?file=${path}`
                if (line) url += `&line=${line}`
                break
            case 'vscode':
                url = `vscode://file/${path}`
                if (line) url += `:${line}`
                break
            case 'cursor':
                url = `cursor://file/${path}`
                if (line) url += `:${line}`
                break
            case 'antigravity':
                url = `windsurf://file/${path}`
                if (line) url += `:${line}`
                break
        }

        if (url) {
            window.location.href = url
        }
        return true
    }

    return {
        showOpenMenu,
        showSettings,
        preferredEditor,
        editors,
        loadSettings,
        saveSettings,
        openInEditor
    }
}
