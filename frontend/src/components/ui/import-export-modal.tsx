'use client';

import React, { useState } from 'react';
import { Upload, Download, AlertCircle, CheckCircle2, FileText, X } from 'lucide-react';
import { Button } from './button';
import { api } from '@/lib/api';

interface ImportResult {
  totalRows: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; phone?: string; error: string }>;
}

export function ImportExportModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    setResult(null);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(Boolean);
      const parsed = lines.slice(0, 6).map((line) => line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, '')));
      setPreviewRows(parsed);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setErrorMsg(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const data = await api.upload<ImportResult>('/customers/import', formData);
      setResult(data);
      if (data.imported > 0) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'CSV import failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    window.open(`${apiUrl}/customers/export`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-card border rounded-2xl shadow-2xl p-6 z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b mb-5">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">Import / Export Customers</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Export section */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border">
            <div>
              <h4 className="font-semibold text-sm">Export Customer Contacts</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Download all audience records, tags, and contact categories as a CSV.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Import section */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Import from CSV</h4>
            <div className="border-2 border-dashed rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                id="csvInput"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="csvInput"
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {selectedFile ? selectedFile.name : 'Click to upload or drag & drop CSV'}
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  Required column: &quot;Phone&quot; (optional: Name, Email)
                </span>
              </label>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2 border border-destructive/20">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Preview table */}
            {previewRows.length > 0 && !result && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  File Preview (First 5 Rows):
                </span>
                <div className="border rounded-lg overflow-x-auto text-xs">
                  <table className="w-full">
                    <thead className="bg-muted text-muted-foreground border-b font-medium">
                      <tr>
                        {previewRows[0]?.map((col, idx) => (
                          <th key={idx} className="p-2 text-left">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(1).map((row, rIdx) => (
                        <tr key={rIdx} className="border-b last:border-0 hover:bg-muted/30">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-2 truncate max-w-[150px]">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleUpload} isLoading={isLoading}>
                    Confirm and Import
                  </Button>
                </div>
              </div>
            )}

            {/* Results & Error report */}
            {result && (
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-xl border bg-muted/40 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Import Completed</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-background border">
                      <div className="font-bold text-base">{result.totalRows}</div>
                      <div className="text-muted-foreground">Total Rows</div>
                    </div>
                    <div className="p-2 rounded bg-background border text-emerald-600">
                      <div className="font-bold text-base">{result.imported}</div>
                      <div className="text-muted-foreground">Imported</div>
                    </div>
                    <div className="p-2 rounded bg-background border text-destructive">
                      <div className="font-bold text-base">{result.failed}</div>
                      <div className="text-muted-foreground">Errors</div>
                    </div>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Row Error Details:
                    </span>
                    <div className="max-h-40 overflow-y-auto rounded-lg border text-xs divide-y bg-destructive/5">
                      {result.errors.map((err, idx) => (
                        <div key={idx} className="p-2 flex justify-between items-center text-destructive">
                          <span>
                            Row {err.row}: {err.phone ? `(${err.phone}) ` : ''}{err.error}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportExportModal;
