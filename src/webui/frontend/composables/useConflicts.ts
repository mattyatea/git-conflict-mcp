import { ref, computed } from 'vue'
import { useToast } from './useToast'

export interface PendingResolve {
    id: string;
    filePath: string;
    absolutePath: string;
    projectPath: string;
    type: "resolve" | "delete" | "add";
    reason?: string;
    fileContent?: string;
    gitDiff?: string;
    timestamp: number;
}

const pendingResolves = ref<PendingResolve[]>([])
const selectedId = ref<string | null>(null)
const loading = ref(false)
const processing = ref<string | null>(null)
const isReviewMode = ref(false)

export function useConflicts() {
    const { showToast } = useToast()

    const selectedItem = computed(() =>
        pendingResolves.value.find(p => p.id === selectedId.value) || null
    )

    const loadPending = async () => {
        loading.value = true
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
        } finally {
            loading.value = false
        }
    }

    const approveResolve = async (id: string, comment?: string, onSuccess?: () => void) => {
        processing.value = id
        try {
            const res = await fetch('/api/approve/' + id, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment })
            })
            const data = await res.json()

            if (data.success) {
                showToast('承認しました: ' + data.message)
                await loadPending()
                if (onSuccess) onSuccess()
            } else {
                showToast('エラー: ' + data.error, 'error')
            }
        } catch (e) {
            showToast('リクエストに失敗しました', 'error')
        } finally {
            processing.value = null
        }
    }

    const rejectResolve = async (id: string, comment?: string, onSuccess?: () => void) => {
        processing.value = id
        try {
            const res = await fetch('/api/reject/' + id, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment })
            })
            const data = await res.json()

            if (data.success) {
                showToast('解決を拒否しました')
                await loadPending()
                if (onSuccess) onSuccess()
            } else {
                showToast('エラー: ' + data.error, 'error')
            }
        } catch (e) {
            showToast('リクエストに失敗しました', 'error')
        } finally {
            processing.value = null
        }
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

    const getTypeLabel = (type: string) => {
        switch (type) {
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

    const loadConfig = async () => {
        try {
            const res = await fetch('/api/config')
            const data = await res.json()
            isReviewMode.value = data.reviewMode
        } catch (e) {
            console.error('Failed to load config:', e)
        }
    }

    return {
        pendingResolves,
        selectedId,
        selectedItem,
        loading,
        processing,
        isReviewMode,
        loadPending,
        loadConfig,
        approveResolve,
        rejectResolve,
        saveContent,
        getTypeLabel,
        formatTime
    }
}
