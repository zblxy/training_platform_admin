import { useEffect, useRef, useState } from 'react';
import { isCertificateExportStatus, type CertificateExportRequest, type CertificateExportStatus } from '@training/shared';

export function CertificateExport({ token, filters, enabled }: { token: string; filters: CertificateExportRequest; enabled: boolean }) {
  const [job, setJob] = useState<CertificateExportStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [pollAttempt, setPollAttempt] = useState(0);
  const [pollFailed, setPollFailed] = useState(false);
  const action = useRef<AbortController | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; action.current?.abort(); };
  }, []);
  const pending = job?.status === 'queued' || job?.status === 'running';
  useEffect(() => {
    if (!job || !pending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    const id = job.id;
    async function poll() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`/api/certificates/exports/${id}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        if (response.status === 404) {
          if (!cancelled) { setJob(null); setPollFailed(false); setError('Export expired or is unavailable. Start a new export.'); }
          return;
        }
        if (!response.ok) throw new Error(response.status === 401 ? 'Supply a valid admin token.' : 'Unable to check export progress.');
        const data: unknown = await response.json();
        if (!isCertificateExportStatus(data) || data.id !== id) throw new Error('Invalid export response.');
        if (!cancelled) {
          setJob(data); setPollFailed(false); setError('');
          if (data.status === 'queued' || data.status === 'running') timer = setTimeout(() => void poll(), 500);
        }
      } catch (cause) {
        if (!cancelled) {
          setPollFailed(true);
          setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Unable to check export progress.');
        }
      } finally { clearTimeout(timeout); }
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); controller?.abort(); };
  }, [job?.id, pending, token, pollAttempt]);
  async function start() {
    setBusy(true); setError(''); setPollFailed(false);
    const controller = new AbortController(); action.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/certificates/exports', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(filters), signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'Supply a valid admin token.' : response.status === 409 ? 'An export is already in progress. Wait for it to finish.' : response.status === 429 ? 'Export queue is full. Please try again shortly.' : 'Unable to start export. Please retry.');
      const data: unknown = await response.json();
      if (!isCertificateExportStatus(data)) throw new Error('Invalid export response.');
      if (active.current) { setJob(data); setPollAttempt(value => value + 1); }
    } catch (cause) {
      if (active.current) setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Unable to start export. Please retry.');
    } finally { clearTimeout(timeout); if (active.current) setBusy(false); }
  }
  async function download() {
    if (!job) return;
    setDownloading(true); setError('');
    const controller = new AbortController(); action.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`/api/certificates/exports/${job.id}/download`, {
        headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 404 ? 'Export expired or is unavailable. Start a new export.' : 'Unable to download CSV. Please retry.');
      const blob = await response.blob();
      if (!active.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `certificates-${job.id}.csv`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      if (active.current) setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Unable to download CSV. Please retry.');
    } finally { clearTimeout(timeout); if (active.current) setDownloading(false); }
  }
  const percent = job && job.total > 0 ? Math.floor(job.processed / job.total * 100) : 0;
  return <div className="certificate-export" role="group" aria-label="Certificate CSV export">
    <button type="button" disabled={!enabled || busy || pending || downloading} onClick={() => void start()}>{busy ? 'Starting export…' : 'Export CSV'}</button>
    <p>Exports all matching certificates across pages using the applied search and sort.</p>
    {job && <>
      <p>Export search: {job.search || 'All certificates'}; sort: {job.sortBy}, {job.sortDirection}.</p>
      {pending && <>
        <progress aria-label="CSV export progress" max={100} value={job.status === 'running' && job.total > 0 ? percent : undefined} />
        <p role="status">{job.status === 'queued' ? 'Export queued…' : `Exporting ${job.processed.toLocaleString()} of ${job.total.toLocaleString()} certificates (${percent}%).`}</p>
      </>}
      {job.status === 'completed' && <>
        <progress aria-label="CSV export progress" max={100} value={100} />
        <p role="status">Export ready: {job.total.toLocaleString()} certificates. Download available until {new Date(job.expiresAt).toLocaleString()}.</p>
        <button type="button" disabled={downloading} onClick={() => void download()}>{downloading ? 'Downloading…' : 'Download CSV'}</button>
      </>}
      {job.status === 'failed' && <p role="alert">{job.error || 'Export failed.'} Use Export CSV to retry.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
    {pollFailed && <button type="button" onClick={() => { setPollFailed(false); setError(''); setPollAttempt(value => value + 1); }}>Retry export status</button>}
  </div>;
}
