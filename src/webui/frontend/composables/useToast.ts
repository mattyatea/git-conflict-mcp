import { ref } from 'vue'

const toast = ref<{ message: string; type: 'success' | 'error'; show: boolean }>({
    message: '',
    type: 'success',
    show: false
})

export function useToast() {
    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        toast.value = { message, type, show: true }
        setTimeout(() => {
            toast.value.show = false
        }, 3000)
    }

    return {
        toast,
        showToast
    }
}
