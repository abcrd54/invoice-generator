const STORAGE_BIZ = 'invoiceBiz';
const STORAGE_INVOICES = 'invoiceData';
let currentInvoiceId = null;
let editingInvoice = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  loadBusinessProfile();
  initInvoiceForm();
  renderInvoiceList();
});

// ===================== BUSINESS PROFILE =====================

function loadBusinessProfile() {
  const saved = localStorage.getItem(STORAGE_BIZ);
  const defaults = {
    name: 'Polyline',
    email: '',
    address: 'Jl. Ngabul - Batealit No.KM. 4, Godang, Mindahan, Kec. Batealit,\nKabupaten Jepara, Jawa Tengah 59461',
    phone: '',
    bank: '',
    logo: 'IMG_20260716_141824.jpg',
    tax: 11
  };
  const biz = saved ? JSON.parse(saved) : defaults;
  document.getElementById('bizName').value = biz.name || defaults.name;
  document.getElementById('bizEmail').value = biz.email || '';
  document.getElementById('bizAddress').value = biz.address || defaults.address;
  document.getElementById('bizPhone').value = biz.phone || '';
  document.getElementById('bizBank').value = biz.bank || '';
  document.getElementById('bizLogo').value = biz.logo || defaults.logo;
  document.getElementById('bizTax').value = biz.tax || defaults.tax;
  updateTaxDisplay();
}

function saveBusinessProfile() {
  const biz = {
    name: document.getElementById('bizName').value.trim(),
    email: document.getElementById('bizEmail').value.trim(),
    address: document.getElementById('bizAddress').value.trim(),
    phone: document.getElementById('bizPhone').value.trim(),
    bank: document.getElementById('bizBank').value.trim(),
    logo: document.getElementById('bizLogo').value.trim(),
    tax: parseFloat(document.getElementById('bizTax').value) || 0
  };
  localStorage.setItem(STORAGE_BIZ, JSON.stringify(biz));
  updateTaxDisplay();
  calculateTotals();
  alert('Profil bisnis disimpan!');
}

function getBusinessProfile() {
  const saved = localStorage.getItem(STORAGE_BIZ);
  return saved ? JSON.parse(saved) : {
    name: 'Polyline',
    email: '',
    address: 'Jl. Ngabul - Batealit No.KM. 4, Godang, Mindahan, Kec. Batealit,\nKabupaten Jepara, Jawa Tengah 59461',
    phone: '',
    bank: '',
    logo: 'IMG_20260716_141824.jpg',
    tax: 11
  };
}

function updateTaxDisplay() {
  const biz = getBusinessProfile();
  document.getElementById('taxRateDisplay').textContent = biz.tax || 0;
}

function toggleSettings() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.toggle('hidden');
}

// ===================== INVOICE FORM =====================

function initInvoiceForm() {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);

  document.getElementById('invoiceDate').value = formatDateInput(today);
  document.getElementById('invoiceDueDate').value = formatDateInput(dueDate);
  document.getElementById('invoiceNo').value = generateInvoiceNo();
  document.getElementById('invoiceStatus').value = 'DRAFT';

  // Set default payment
  document.getElementById('paymentMethod').value = 'Bank Transfer';
  document.getElementById('bankName').value = 'CIMB NIAGA';
  document.getElementById('bankAccount').value = '800206032000';
  document.getElementById('bankHolder').value = 'MAJU ABADI KREATIVA';

  // Set default terms
  document.getElementById('terms1').value = 'Order will be processed and shipped after full payment is received.\nPesanan akan diproses dan dikirim setelah pembayaran diterima secara penuh.';
  document.getElementById('terms2').value = 'Shipping cost and delivery time depend on the selected shipping method.\nBiaya pengiriman dan waktu pengiriman tergantung pada metode pengiriman yang dipilih.';
  document.getElementById('terms3').value = 'The product includes a 6-month warranty for normal use.\nProduk memiliki garansi 6 bulan untuk pemakaian normal.';

  // Add first item row
  addItemRow();

  // Listen for tax rate changes
  document.getElementById('bizTax').addEventListener('input', function() {
    updateTaxDisplay();
    calculateTotals();
  });
}

function generateInvoiceNo() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const dd = String(now.getDate()).padStart(2, '0');
  const invoices = getInvoices();
  const existingNos = new Set(invoices.map(inv => inv.invoiceNo));
  let random;
  do {
    random = String(Math.floor(Math.random() * 900) + 100);
  } while (existingNos.has(`POLY/INV/${mm}${yy}${dd}/${random}`));
  return `POLY/INV/${mm}${yy}${dd}/${random}`;
}

function formatDateInput(date) {
  return date.toISOString().split('T')[0];
}

// ===================== ITEM ROWS =====================

function addItemRow() {
  const tbody = document.getElementById('itemsBody');
  const rowNum = tbody.rows.length + 1;

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="text-align:center;vertical-align:middle;">${rowNum}</td>
    <td><input type="text" class="item-desc" placeholder="Deskripsi item"></td>
    <td><input type="number" class="item-qty" min="0" value="1" oninput="calculateRow(this)"></td>
    <td><input type="text" class="item-rate" inputmode="numeric" placeholder="0" oninput="handleRateInput(this)"></td>
    <td><input type="text" class="item-amount" readonly></td>
    <td><button class="btn-remove" onclick="removeItemRow(this)" title="Hapus">×</button></td>
  `;

  tbody.appendChild(tr);
  calculateTotals();
}

function removeItemRow(btn) {
  const tbody = document.getElementById('itemsBody');
  if (tbody.rows.length <= 1) {
    alert('Minimal harus ada 1 item');
    return;
  }
  btn.closest('tr').remove();
  renumberRows();
  calculateTotals();
}

function renumberRows() {
  const tbody = document.getElementById('itemsBody');
  Array.from(tbody.rows).forEach((row, i) => {
    row.cells[0].textContent = i + 1;
  });
}

function calculateRow(input) {
  const row = input.closest('tr');
  const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
  const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
  const amount = qty * rate;
  row.querySelector('.item-amount').value = formatRupiah(amount);
  calculateTotals();
}

function handleRateInput(input) {
  let val = input.value.replace(/[^0-9]/g, '');
  if (val.length > 1 && val.startsWith('0')) {
    val = val.replace(/^0+/, '');
  }
  input.value = val;
  calculateRow(input);
}

function handleDiskonInput(input) {
  let val = input.value.replace(/[^0-9]/g, '');
  if (val.length > 1 && val.startsWith('0')) {
    val = val.replace(/^0+/, '');
  }
  input.value = val;
  calculateTotals();
}

function handleOngkirInput(input) {
  let val = input.value.replace(/[^0-9]/g, '');
  if (val.length > 1 && val.startsWith('0')) {
    val = val.replace(/^0+/, '');
  }
  input.value = val;
  calculateTotals();
}

function calculateTotals() {
  const biz = getBusinessProfile();
  const taxRate = biz.tax || 0;
  const ppnCheckbox = document.getElementById('ppnEnabled');
  const ppnEnabled = ppnCheckbox ? ppnCheckbox.checked : true;
  let subtotal = 0;

  const rows = document.getElementById('itemsBody').rows;
  Array.from(rows).forEach(row => {
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
    subtotal += qty * rate;
  });

  const taxAmount = ppnEnabled ? subtotal * (taxRate / 100) : 0;
  const diskon = parseFloat(document.getElementById('diskon').value.replace(/[^0-9]/g, '')) || 0;
  const ongkir = parseFloat(document.getElementById('ongkir').value.replace(/[^0-9]/g, '')) || 0;
  const total = subtotal + taxAmount - diskon + ongkir;

  document.getElementById('subtotalDisplay').textContent = formatRupiah(subtotal);
  document.getElementById('taxDisplay').textContent = formatRupiah(taxAmount);
  document.getElementById('taxRateDisplay').textContent = ppnEnabled ? taxRate : 0;
  document.getElementById('totalDisplay').textContent = formatRupiah(total);
}

// ===================== SAVE / LOAD / DELETE =====================

function getFormData() {
  const biz = getBusinessProfile();
  const ppnCheckbox = document.getElementById('ppnEnabled');
  const ppnEnabled = ppnCheckbox ? ppnCheckbox.checked : true;
  const items = [];
  const rows = document.getElementById('itemsBody').rows;

  let subtotal = 0;
  Array.from(rows).forEach(row => {
    const desc = row.querySelector('.item-desc').value.trim();
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
    const amount = qty * rate;
    if (desc || qty > 0 || rate > 0) {
      items.push({ description: desc, qty, rate, amount });
      subtotal += amount;
    }
  });

  const taxRate = ppnEnabled ? (biz.tax || 0) : 0;
  const taxAmount = subtotal * (taxRate / 100);
  const diskon = parseFloat(document.getElementById('diskon').value.replace(/[^0-9]/g, '')) || 0;
  const ongkir = parseFloat(document.getElementById('ongkir').value.replace(/[^0-9]/g, '')) || 0;
  const total = subtotal + taxAmount - diskon + ongkir;

  return {
    id: currentInvoiceId || Date.now().toString(),
    invoiceNo: document.getElementById('invoiceNo').value,
    date: document.getElementById('invoiceDate').value,
    dueDate: document.getElementById('invoiceDueDate').value,
    status: document.getElementById('invoiceStatus').value,
    billToName: document.getElementById('billToName').value.trim(),
    billToPhone: document.getElementById('billToPhone').value.trim(),
    billToAddress: document.getElementById('billToAddress').value.trim(),
    sendToName: document.getElementById('sendToName').value.trim(),
    sendToPhone: document.getElementById('sendToPhone').value.trim(),
    sendToAddress: document.getElementById('sendToAddress').value.trim(),
    items,
    subtotal,
    taxRate,
    taxAmount,
    diskon,
    ongkir,
    total,
    ppnEnabled,
    notes: document.getElementById('invoiceNotes').value.trim(),
    paymentMethod: document.getElementById('paymentMethod').value.trim(),
    bankName: document.getElementById('bankName').value.trim(),
    bankAccount: document.getElementById('bankAccount').value.trim(),
    bankHolder: document.getElementById('bankHolder').value.trim(),
    terms1: document.getElementById('terms1').value.trim(),
    terms2: document.getElementById('terms2').value.trim(),
    terms3: document.getElementById('terms3').value.trim()
  };
}

function saveInvoice() {
  const data = getFormData();

  if (!data.billToName) {
    alert('Nama customer harus diisi!');
    return;
  }
  if (data.items.length === 0) {
    alert('Minimal harus ada 1 item!');
    return;
  }

  const invoices = getInvoices();
  const existingIdx = invoices.findIndex(inv => inv.id === data.id);

  if (existingIdx >= 0) {
    invoices[existingIdx] = data;
  } else {
    invoices.push(data);
  }

  localStorage.setItem(STORAGE_INVOICES, JSON.stringify(invoices));
  renderInvoiceList();
  resetForm();
  alert('Invoice berhasil disimpan!');
}

function getInvoices() {
  const saved = localStorage.getItem(STORAGE_INVOICES);
  return saved ? JSON.parse(saved) : [];
}

function deleteInvoice(id) {
  if (!confirm('Hapus invoice ini?')) return;
  let invoices = getInvoices();
  invoices = invoices.filter(inv => inv.id !== id);
  localStorage.setItem(STORAGE_INVOICES, JSON.stringify(invoices));
  renderInvoiceList();
}

function editInvoice(id) {
  const invoices = getInvoices();
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;

  currentInvoiceId = inv.id;

  document.getElementById('invoiceNo').value = inv.invoiceNo;
  document.getElementById('invoiceDate').value = inv.date;
  document.getElementById('invoiceDueDate').value = inv.dueDate;
  document.getElementById('invoiceStatus').value = inv.status;
  document.getElementById('billToName').value = inv.billToName;
  document.getElementById('billToPhone').value = inv.billToPhone || '';
  document.getElementById('billToAddress').value = inv.billToAddress || '';
  document.getElementById('sendToName').value = inv.sendToName || '';
  document.getElementById('sendToPhone').value = inv.sendToPhone || '';
  document.getElementById('sendToAddress').value = inv.sendToAddress || '';
  const ppnCb = document.getElementById('ppnEnabled');
  if (ppnCb) ppnCb.checked = inv.ppnEnabled !== false;
  document.getElementById('diskon').value = inv.diskon || 0;
  document.getElementById('ongkir').value = inv.ongkir || 0;
  document.getElementById('invoiceNotes').value = inv.notes || '';
  document.getElementById('paymentMethod').value = inv.paymentMethod || 'Bank Transfer';
  document.getElementById('bankName').value = inv.bankName || '';
  document.getElementById('bankAccount').value = inv.bankAccount || '';
  document.getElementById('bankHolder').value = inv.bankHolder || '';
  document.getElementById('terms1').value = inv.terms1 || '';
  document.getElementById('terms2').value = inv.terms2 || '';
  document.getElementById('terms3').value = inv.terms3 || '';

  // Clear and rebuild items
  const tbody = document.getElementById('itemsBody');
  tbody.innerHTML = '';

  if (inv.items && inv.items.length > 0) {
    inv.items.forEach(item => {
      addItemRow();
      const row = tbody.lastElementChild;
      row.querySelector('.item-desc').value = item.description;
      row.querySelector('.item-qty').value = item.qty;
      row.querySelector('.item-rate').value = item.rate;
      row.querySelector('.item-amount').value = formatRupiah(item.amount);
    });
  } else {
    addItemRow();
  }

  renumberRows();
  calculateTotals();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  currentInvoiceId = null;
  document.getElementById('billToName').value = '';
  document.getElementById('billToPhone').value = '';
  document.getElementById('billToAddress').value = '';
  document.getElementById('sendToName').value = '';
  document.getElementById('sendToPhone').value = '';
  document.getElementById('sendToAddress').value = '';
  document.getElementById('invoiceStatus').value = 'DRAFT';
  const ppnCb2 = document.getElementById('ppnEnabled');
  if (ppnCb2) ppnCb2.checked = true;
  document.getElementById('diskon').value = 0;
  document.getElementById('ongkir').value = 0;
  document.getElementById('invoiceNotes').value = '';

  // Reset payment to defaults
  document.getElementById('paymentMethod').value = 'Bank Transfer';
  document.getElementById('bankName').value = 'CIMB NIAGA';
  document.getElementById('bankAccount').value = '800206032000';
  document.getElementById('bankHolder').value = 'MAJU ABADI KREATIVA';

  // Reset terms to defaults
  document.getElementById('terms1').value = 'Order will be processed and shipped after full payment is received.\nPesanan akan diproses dan dikirim setelah pembayaran diterima secara penuh.';
  document.getElementById('terms2').value = 'Shipping cost and delivery time depend on the selected shipping method.\nBiaya pengiriman dan waktu pengiriman tergantung pada metode pengiriman yang dipilih.';
  document.getElementById('terms3').value = 'The product includes a 6-month warranty for normal use.\nProduk memiliki garansi 6 bulan untuk pemakaian normal.';

  const tbody = document.getElementById('itemsBody');
  tbody.innerHTML = '';
  addItemRow();

  document.getElementById('invoiceNo').value = generateInvoiceNo();
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);
  document.getElementById('invoiceDate').value = formatDateInput(today);
  document.getElementById('invoiceDueDate').value = formatDateInput(dueDate);

  calculateTotals();
}

// ===================== RENDER LIST =====================

function renderInvoiceList() {
  const container = document.getElementById('listContainer');
  const invoices = getInvoices();

  if (invoices.length === 0) {
    container.innerHTML = '<p class="empty-msg">Belum ada invoice tersimpan.</p>';
    return;
  }

  container.innerHTML = invoices.map(inv => {
    const badgeClass = 'badge-' + inv.status.toLowerCase();
    const statusLabel = { DRAFT: 'Draft', SENT: 'Terkirim', PAID: 'Lunas', OVERDUE: 'Jatuh Tempo' };
    return `
      <div class="invoice-item">
        <div class="inv-info">
          <span class="inv-no">${escapeHtml(inv.invoiceNo)}</span>
          <span class="badge ${badgeClass}">${statusLabel[inv.status] || inv.status}</span>
          <div class="inv-client">${escapeHtml(inv.billToName)}</div>
          <div class="inv-date">${formatDate(inv.date)} &mdash; Jatuh Tempo: ${formatDate(inv.dueDate)}</div>
        </div>
        <div class="inv-amount">${formatRupiah(inv.total)}</div>
        <div class="inv-actions">
          <button class="btn btn-sm" onclick="editInvoice('${inv.id}')">✏️ Edit</button>
          <button class="btn btn-sm btn-success" onclick="downloadInvoicePDF('${inv.id}')">🖨️ PDF</button>
          <button class="btn btn-sm btn-danger" onclick="deleteInvoice('${inv.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

// ===================== PREVIEW & PDF =====================

let currentPreviewInvoice = null;

function previewInvoice() {
  const data = getFormData();
  const biz = getBusinessProfile();
  currentPreviewInvoice = data;

  const html = generateInvoiceHTML(data, biz);
  document.getElementById('previewBody').innerHTML = html;
  document.getElementById('previewModal').classList.remove('hidden');
}

function closePreview() {
  document.getElementById('previewModal').classList.add('hidden');
}

function generatePDF() {
  if (!currentPreviewInvoice) {
    alert('Preview dulu sebelum generate PDF');
    return;
  }
  printInvoice(currentPreviewInvoice);
}

function downloadInvoicePDF(id) {
  const invoices = getInvoices();
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  printInvoice(inv);
}

function printInvoice(invoice) {
  const biz = getBusinessProfile();
  const html = generateInvoiceHTML(invoice, biz);
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = html;

  const images = printArea.querySelectorAll('img');
  const imgPromises = Array.from(images).map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });

  Promise.all(imgPromises).then(() => {
    window.print();
  });
}
