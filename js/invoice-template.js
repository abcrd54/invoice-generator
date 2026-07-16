function generateInvoiceHTML(invoice, biz) {
  const items = invoice.items || [];
  const rows = items.map((item, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${escapeHtml(item.description)}</td>
      <td style="text-align:right">${item.qty}</td>
      <td style="text-align:right">${formatRupiah(item.rate)}</td>
      <td style="text-align:right">${formatRupiah(item.amount)}</td>
    </tr>
  `).join('');

  const logoHTML = biz.logo
    ? `<img src="${biz.logo}" alt="Logo" style="max-height:55px;max-width:160px;object-fit:contain;">`
    : '';

  const terms = [invoice.terms1, invoice.terms2, invoice.terms3].filter(t => t).join('\n');

  return `
    <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#222;font-size:10px;line-height:1.35;padding:6mm 8mm;">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;border-bottom:2px solid #222;padding-bottom:6px;">
        <div>
          ${logoHTML}
          <div style="font-size:9px;color:#555;margin-top:3px;">${escapeHtml(biz.address || '').replace(/\n/g, '<br>')}</div>
          <div style="font-size:9px;color:#555;">${escapeHtml(biz.phone || '')} ${biz.email ? '| ' + escapeHtml(biz.email) : ''}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:20px;font-weight:800;color:#222;letter-spacing:2px;">INVOICE</div>
          <div style="margin-top:3px;font-size:9px;color:#444;">
            <table style="border-collapse:collapse;margin-left:auto;">
              <tr><td style="padding:0 6px 0 0;color:#777;font-size:9px;">No.</td><td style="padding:0;font-size:9px;font-weight:600;">${escapeHtml(invoice.invoiceNo)}</td></tr>
              <tr><td style="padding:0 6px 0 0;color:#777;font-size:9px;">Tanggal</td><td style="padding:0;font-size:9px;">${formatDate(invoice.date)}</td></tr>
              <tr><td style="padding:0 6px 0 0;color:#777;font-size:9px;">Jatuh Tempo</td><td style="padding:0;font-size:9px;">${formatDate(invoice.dueDate)}</td></tr>
            </table>
          </div>
        </div>
      </div>

      <!-- Bill To & Send To -->
      <div style="display:flex;gap:12px;margin-bottom:8px;">
        <div style="flex:1;background:#f5f5f5;padding:6px 10px;border-radius:3px;border-left:3px solid #222;">
          <div style="font-size:9px;color:#777;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;font-weight:600;">Bill To</div>
          <div style="font-size:11px;font-weight:600;">${escapeHtml(invoice.billToName || '-')}</div>
          <div style="font-size:9px;color:#444;">${escapeHtml(invoice.billToPhone || '')}</div>
          <div style="font-size:9px;color:#555;">${escapeHtml(invoice.billToAddress || '').replace(/\n/g, '<br>')}</div>
        </div>
        <div style="flex:1;background:#f5f5f5;padding:6px 10px;border-radius:3px;border-left:3px solid #222;">
          <div style="font-size:9px;color:#777;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;font-weight:600;">Send To</div>
          <div style="font-size:11px;font-weight:600;">${escapeHtml(invoice.sendToName || '-')}</div>
          <div style="font-size:9px;color:#444;">${escapeHtml(invoice.sendToPhone || '')}</div>
          <div style="font-size:9px;color:#555;">${escapeHtml(invoice.sendToAddress || '').replace(/\n/g, '<br>')}</div>
        </div>
      </div>

      <!-- Items Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <thead>
          <tr>
            <th style="background:#222;color:#fff;padding:5px 8px;text-align:left;font-size:9px;font-weight:600;width:30px;">#</th>
            <th style="background:#222;color:#fff;padding:5px 8px;text-align:left;font-size:9px;font-weight:600;">Deskripsi</th>
            <th style="background:#222;color:#fff;padding:5px 8px;text-align:right;font-size:9px;font-weight:600;width:45px;">Qty</th>
            <th style="background:#222;color:#fff;padding:5px 8px;text-align:right;font-size:9px;font-weight:600;width:90px;">Harga</th>
            <th style="background:#222;color:#fff;padding:5px 8px;text-align:right;font-size:9px;font-weight:600;width:90px;">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <!-- Totals + Payment Side by Side -->
      <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;">
        ${invoice.bankName ? `
        <div style="background:#f5f5f5;padding:6px 10px;border-radius:3px;font-size:9px;color:#444;border-left:3px solid #222;flex:1;">
          <strong style="display:block;margin-bottom:2px;color:#222;">Payment Method</strong>
          ${escapeHtml(invoice.bankName)} - ${escapeHtml(invoice.bankAccount)}<br>
          a/n ${escapeHtml(invoice.bankHolder)}
        </div>
        ` : '<div style="flex:1;"></div>'}
        <div style="width:220px;">
          <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:10px;">
            <span>Subtotal</span>
            <span>${formatRupiah(invoice.subtotal)}</span>
          </div>
          ${invoice.ppnEnabled !== false ? `
          <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:10px;">
            <span>PPN (${invoice.taxRate}%)</span>
            <span>${formatRupiah(invoice.taxAmount)}</span>
          </div>
          ` : ''}
          ${invoice.diskon ? `
          <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:10px;">
            <span>Diskon</span>
            <span>- ${formatRupiah(invoice.diskon)}</span>
          </div>
          ` : ''}
          ${invoice.ongkir ? `
          <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:10px;">
            <span>Ongkir</span>
            <span>+ ${formatRupiah(invoice.ongkir)}</span>
          </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;font-weight:700;color:#222;border-top:2px solid #222;margin-top:3px;">
            <span>TOTAL</span>
            <span>${formatRupiah(invoice.total)}</span>
          </div>
        </div>
      </div>

      <!-- Notes -->
      ${invoice.notes ? `
      <div style="border:1px solid #222;padding:6px 10px;margin-bottom:8px;font-size:9px;color:#444;">
        <strong style="display:block;margin-bottom:2px;color:#222;">Notes</strong>
        ${escapeHtml(invoice.notes).replace(/\n/g, '<br>')}
      </div>
      ` : ''}

      <!-- Terms & Conditions -->
      ${terms ? `
      <div style="background:#fafafa;padding:6px 10px;border-radius:3px;margin-bottom:8px;font-size:8px;color:#555;border:1px solid #ddd;">
        <strong style="display:block;margin-bottom:3px;color:#222;font-size:9px;">Terms & Conditions</strong>
        <ol style="margin:0;padding-left:14px;">
          ${invoice.terms1 ? `<li style="margin-bottom:2px;">${escapeHtml(invoice.terms1).replace(/\n/g, '<br>')}</li>` : ''}
          ${invoice.terms2 ? `<li style="margin-bottom:2px;">${escapeHtml(invoice.terms2).replace(/\n/g, '<br>')}</li>` : ''}
          ${invoice.terms3 ? `<li style="margin-bottom:2px;">${escapeHtml(invoice.terms3).replace(/\n/g, '<br>')}</li>` : ''}
        </ol>
      </div>
      ` : ''}

      <!-- Footer Signatures -->
      <div style="display:flex;justify-content:space-between;margin-top:14px;">
        <div style="text-align:center;width:140px;">
          <div style="border-top:1px solid #222;margin-top:28px;padding-top:3px;font-size:9px;color:#555;">Penerima</div>
        </div>
        <div style="text-align:center;width:140px;">
          <div style="border-top:1px solid #222;margin-top:28px;padding-top:3px;font-size:9px;color:#555;">Hormat Kami</div>
        </div>
      </div>

    </div>
  `;
}

function formatRupiah(amount) {
  if (amount == null || isNaN(amount)) return 'Rp 0';
  return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
