const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res;
}

export function getCompany() {
  return request('/company');
}

export function updateCompany(data) {
  return request('/company', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function uploadLogo(file) {
  const formData = new FormData();
  formData.append('logo', file);
  return request('/company/logo', {
    method: 'POST',
    body: formData,
  });
}

export function getLogoUrl() {
  return `${API_BASE}/company/logo`;
}

export function getClients() {
  return request('/clients');
}

export function searchClients(query) {
  return request(`/clients/search?q=${encodeURIComponent(query)}`);
}

export function upsertClient(data) {
  return request('/clients/upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function createClient(data) {
  return request('/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateClient(id, data) {
  return request(`/clients/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteClient(id) {
  return request(`/clients/${id}`, { method: 'DELETE' });
}

export function getInvoices() {
  return request('/invoices');
}

export function getNextInvoiceNumber() {
  return request('/invoices/next-number');
}

export function getInvoice(id) {
  return request(`/invoices/${id}`);
}

export function createInvoice(data) {
  return request('/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function autosaveInvoice(data) {
  return request('/invoices/autosave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateInvoice(id, data) {
  return request(`/invoices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function getInvoicePdfUrl(id, cacheBust) {
  const version = cacheBust ?? Date.now();
  return `${API_BASE}/invoices/${id}/pdf?v=${version}`;
}

export function deleteInvoice(id) {
  return request(`/invoices/${id}`, { method: 'DELETE' });
}

export function addInvoicePayment(invoiceId, data) {
  return request(`/invoices/${invoiceId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteInvoicePayment(invoiceId, paymentId) {
  return request(`/invoices/${invoiceId}/payments/${paymentId}`, { method: 'DELETE' });
}

export function getPaymentAccounts() {
  return request('/payment-accounts');
}

export function createPaymentAccount(data) {
  return request('/payment-accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updatePaymentAccount(id, data) {
  return request(`/payment-accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deletePaymentAccount(id) {
  return request(`/payment-accounts/${id}`, { method: 'DELETE' });
}
