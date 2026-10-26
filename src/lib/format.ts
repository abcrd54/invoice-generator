export function formatRupiah(amount: number | null | undefined): string {
  if (amount == null || isNaN(Number(amount))) return 'Rp 0';
  return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
}

/** Tanggal hari ini (WIB) dalam format YYYY-MM-DD. */
export function todayISO(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}
