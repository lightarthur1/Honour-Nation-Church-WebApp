const TOKEN_KEY = 'cmg_token'

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ }
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status }
}

function errorMessage(data, status) {
  const d = data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x) => x.msg).join('. ')
  return `Request failed (${status})`
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {}
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status)
  return data
}

/** Multipart upload with progress (fetch can't report upload progress). */
export function uploadForm(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api${path}`)
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
    xhr.onerror = () => reject(new ApiError('Network error during upload', 0))
    xhr.onload = () => {
      let data = null
      try { data = JSON.parse(xhr.responseText) } catch { /* empty */ }
      xhr.status >= 200 && xhr.status < 300 ? resolve(data) : reject(new ApiError(errorMessage(data, xhr.status), xhr.status))
    }
    xhr.send(form)
  })
}

export function uploadFile(path, file, onProgress) {
  const form = new FormData()
  form.append('file', file)
  return uploadForm(path, form, onProgress)
}

/** Browser-native downloads can't send headers, so the token rides in the query string. */
export const authedUrl = (path) => `/api${path}?token=${encodeURIComponent(getToken() || '')}`

export const endpoints = {
  login: (b) => api('/auth/login', { method: 'POST', body: b, auth: false }),
  register: (b) => api('/auth/register', { method: 'POST', body: b, auth: false }),
  me: () => api('/auth/me'),
  users: () => api('/users'),
  setRole: (id, role) => api(`/users/${id}/role`, { method: 'PATCH', body: { role } }),
  events: () => api('/events'),
  createEvent: (b) => api('/events', { method: 'POST', body: b }),
  deleteEvent: (id) => api(`/events/${id}`, { method: 'DELETE' }),
  assignEditors: (id, editor_ids) => api(`/events/${id}/editors`, { method: 'PUT', body: { editor_ids } }),
  deleteRaw: (id) => api(`/events/${id}/raw`, { method: 'DELETE' }),
  resync: (id) => api(`/events/${id}/edited/sync`, { method: 'POST' }),
  uploadRaw: (id, file, cb) => uploadFile(`/events/${id}/raw`, file, cb),
  uploadEdited: (id, file, cb) => uploadFile(`/events/${id}/edited`, file, cb),
  editedLink: (id) => api(`/events/${id}/edited/link`),
  galleryEvents: () => api('/gallery/events'),
  galleryEvent: (id) => api(`/gallery/events/${id}`),
  galleryImages: (id) => api(`/gallery/events/${id}/images`),
  searchPhotos: (query) => api(`/gallery/search?q=${encodeURIComponent(query)}`),
  requestAccess: (id) => api(`/events/${id}/access-requests`, { method: 'POST' }),
  accessRequests: (status) => api(`/access-requests${status ? `?status=${status}` : ''}`),
  decide: (id, approve) => api(`/access-requests/${id}/decision`, { method: 'POST', body: { approve } }),
  announcements: () => api('/announcements', { auth: false }),
  adminAnnouncements: () => api('/announcements/admin'),
  createAnnouncement: (body) => api('/announcements', { method: 'POST', body }),
  updateAnnouncement: (id, body) => api(`/announcements/${id}`, { method: 'PUT', body }),
  deleteAnnouncement: (id) => api(`/announcements/${id}`, { method: 'DELETE' }),
  programEvents: () => api('/program-events', { auth: false }),
  programEvent: (id) => api(`/program-events/${id}`, { auth: false }),
  adminProgramEvents: () => api('/program-events/admin'),
  createProgramEvent: (body) => api('/program-events', { method: 'POST', body }),
  updateProgramEvent: (id, body) => api(`/program-events/${id}`, { method: 'PUT', body }),
  deleteProgramEvent: (id) => api(`/program-events/${id}`, { method: 'DELETE' }),
  uploadProgramEventPoster: (id, file, cb) => uploadFile(`/program-events/${id}/poster`, file, cb),
  deleteProgramEventPoster: (id) => api(`/program-events/${id}/poster`, { method: 'DELETE' }),
  streamItems: () => api('/stream-items', { auth: false }),
  adminStreamItems: () => api('/stream-items/admin'),
  createStreamItem: (body) => api('/stream-items', { method: 'POST', body }),
  updateStreamItem: (id, body) => api(`/stream-items/${id}`, { method: 'PUT', body }),
  deleteStreamItem: (id) => api(`/stream-items/${id}`, { method: 'DELETE' }),
  notices: () => api('/notices', { auth: false }),
  adminNotices: () => api('/notices/admin'),
  createNotice: (body) => api('/notices', { method: 'POST', body }),
  updateNotice: (id, body) => api(`/notices/${id}`, { method: 'PUT', body }),
  deleteNotice: (id) => api(`/notices/${id}`, { method: 'DELETE' }),
  documents: () => api('/documents', { auth: false }),
  adminDocuments: () => api('/documents/admin'),
  createDocument: (form, cb) => uploadForm('/documents', form, cb),
  updateDocument: (id, body) => api(`/documents/${id}`, { method: 'PUT', body }),
  replaceDocumentFile: (id, file, cb) => uploadFile(`/documents/${id}/file`, file, cb),
  deleteDocument: (id) => api(`/documents/${id}`, { method: 'DELETE' }),
  documentDownloadUrl: (id) => `/api/documents/${id}/download`,
}
