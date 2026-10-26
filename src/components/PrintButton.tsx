'use client';

export function PrintButton() {
  return (
    <button className="btn btn-success" onClick={() => window.print()}>
      🖨️ Cetak / Simpan PDF
    </button>
  );
}
