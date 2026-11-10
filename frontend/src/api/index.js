import { http, API_BASE } from './client'

const data = (p) => p.then((r) => r.data)

export const auth = {
  login: (email, password) => data(http.post('/auth/login', { email, password })),
  register: (email, full_name, password) =>
    data(http.post('/auth/register', { email, full_name, password })),
  me: () => data(http.get('/auth/me')),
}

export const gallery = {
  events: (page = 1, page_size = 12) => data(http.get('/gallery/events', { params: { page, page_size } })),
  event: (id, page = 1, page_size = 48) =>
    data(http.get(`/gallery/events/${id}`, { params: { page, page_size } })),
  download: (id) => data(http.get(`/gallery/events/${id}/download`)),
}

export const access = {
  request: (event_id, message) => data(http.post('/access-requests', { event_id, message })),
  list: (status) => data(http.get('/access-requests', { params: status ? { status } : {} })),
  pendingCount: () => data(http.get('/access-requests/pending-count')),
  approve: (id) => data(http.post(`/access-requests/${id}/approve`)),
  deny: (id) => data(http.post(`/access-requests/${id}/deny`)),
  revoke: (id) => data(http.post(`/access-requests/${id}/revoke`)),
}

export const events = {
  list: () => data(http.get('/events')),
  get: (id) => data(http.get(`/events/${id}`)),
  create: (body) => data(http.post('/events', body)),
  update: (id, body) => data(http.patch(`/events/${id}`, body)),
  remove: (id) => http.delete(`/events/${id}`),
  setEditors: (id, editor_ids) => data(http.put(`/events/${id}/editors`, { editor_ids })),
}

// Large uploads: no timeout, progress callback gets 0..1.
const upload = (url, file, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  return data(
    http.post(url, form, {
      timeout: 0,
      onUploadProgress: (e) => e.total && onProgress?.(e.loaded / e.total),
    }),
  )
}

export const archives = {
  uploadRaw: (eventId, file, onProgress) => upload(`/events/${eventId}/raw`, file, onProgress),
  deleteRaw: (eventId, rawId) => data(http.delete(`/events/${eventId}/raw/${rawId}`)),
  rawDownloadLink: (eventId, rawId) =>
    data(http.post(`/events/${eventId}/raw/${rawId}/download-link`)),
  uploadEdited: (eventId, file, onProgress) => upload(`/events/${eventId}/edited`, file, onProgress),
  listEdited: (eventId) => data(http.get(`/events/${eventId}/edited`)),
  syncDrive: (id) => data(http.post(`/edited/${id}/sync-drive`)),
  reprocess: (id) => data(http.post(`/edited/${id}/reprocess`)),
}

/** Start a native browser download (streams, resumable, no memory use). */
export async function downloadRaw(eventId, rawId) {
  const { url } = await archives.rawDownloadLink(eventId, rawId)
  window.location.href = `${API_BASE}${url}`
}

export const users = {
  list: (params) => data(http.get('/users', { params })),
  create: (body) => data(http.post('/users', body)),
  update: (id, body) => data(http.patch(`/users/${id}`, body)),
}

export const admin = {
  stats: () => data(http.get('/admin/stats')),
  driveStatus: () => data(http.get('/admin/drive/status')),
}
