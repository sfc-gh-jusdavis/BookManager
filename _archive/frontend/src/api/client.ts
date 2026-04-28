import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const mockUser = localStorage.getItem('mock-user-id')
  if (mockUser) {
    config.headers['X-Mock-User'] = mockUser
  }
  return config
})

export default api
