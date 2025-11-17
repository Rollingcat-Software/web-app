import axios from 'axios'

// Create axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT as string) || 30000,
    headers: {
        'Content-Type': 'application/json',
    },
})

export default api
