"use client";

import { useRef } from "react";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
};

export default function DocumentPicker({ files, onChange, multiple = false, disabled = false }: Props) {
  const pdfInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  function select(input: HTMLInputElement) {
    const selected = Array.from(input.files ?? []);
    if (selected.length) onChange(multiple ? [...files, ...selected] : selected.slice(0, 1));
    input.value = "";
  }

  return (
    <div className="space-y-2">
      <p className="text-sm">PDF, JPG o PNG · massimo 10 MB ciascuno</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="button-secondary" disabled={disabled} onClick={() => pdfInput.current?.click()}>Scegli PDF</button>
        <button type="button" className="button-secondary" disabled={disabled} onClick={() => photoInput.current?.click()}>Scegli foto</button>
      </div>
      <input ref={pdfInput} type="file" accept="application/pdf" multiple={multiple} disabled={disabled} className="hidden" aria-label="Seleziona documenti PDF" onChange={e => select(e.currentTarget)} />
      <input ref={photoInput} type="file" accept="image/jpeg,image/png" multiple={multiple} disabled={disabled} className="hidden" aria-label="Seleziona foto JPG o PNG" onChange={e => select(e.currentTarget)} />
      <p className="text-xs text-slate-500">Per i PDF usa il selettore documenti. Le origini disponibili dipendono dal telefono e dalle app installate.</p>
      {files.length > 0 && <ul className="space-y-1 text-sm">
        {files.map((file, index) => <li key={index} className="flex items-center justify-between gap-2">
          <span className="min-w-0 break-words">{file.name}</span>
          <button type="button" className="button-secondary shrink-0" disabled={disabled} aria-label={`Rimuovi ${file.name} dalla selezione`} onClick={() => onChange(files.filter((_, i) => i !== index))}>Rimuovi</button>
        </li>)}
      </ul>}
    </div>
  );
}
