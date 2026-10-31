import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isCertificateDetail, type CertificateDetail as Detail } from '@training/shared';
import { localDateTime } from './local-date-time';

interface Props { id: string; token: string; onClose: () => void; onRevoked: () => void }
export function CertificateDetail({ id, token, onClose, onRevoked }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unauthorized' | 'missing' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const mutation = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    heading.current?.focus();
    return () => { mounted.current = false; mutation.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setState('loading'); setDetail(null);
    void fetch(`/api/certificates/${id}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        if (response.status === 401 || response.status === 404) {
          if (active) setState(response.status === 401 ? 'unauthorized' : 'missing');
          return;
        }
        if (!response.ok) throw new Error('Detail request failed');
        const data: unknown = await response.json();
        if (!isCertificateDetail(data)) throw new Error('Invalid detail');
        if (active) { setDetail(data); setState('ready'); }
      }).catch(() => { if (active) setState('error'); }).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [id, token, attempt]);
  async function revoke(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !reason.trim()) return;
    inFlight.current = true; setSaving(true); setSaveError('');
    const controller = new AbortController(); mutation.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`/api/certificates/${id}/revoke`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }), signal: controller.signal,
      });
      if (!mounted.current) return;
      if (!response.ok) {
        setSaveError(response.status === 401 ? 'Your token is no longer authorized.' : response.status === 404 ? 'Certificate not found.' : 'Unable to revoke certificate. Retry or cancel and reload its details.');
        return;
      }
      const data: unknown = await response.json();
      if (!isCertificateDetail(data) || data.status !== 'revoked') throw new Error('Invalid revocation response');
      if (mounted.current) {
        setDetail(data); setSuccess(true); dialog.current?.close(); onRevoked(); heading.current?.focus();
      }
    } catch {
      if (mounted.current) setSaveError('The result could not be confirmed. Retry safely, or cancel and reload its details.');
    } finally {
      clearTimeout(timeout); inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return <section aria-labelledby="certificate-detail-heading">
    <h2 id="certificate-detail-heading" tabIndex={-1} ref={heading}>Certificate detail</h2>
    <button onClick={onClose}>Close certificate detail</button>
    {state === 'loading' && <p role="status">Loading certificate detail…</p>}
    {state === 'unauthorized' && <p role="alert">Your token is no longer authorized. Supply a valid token.</p>}
    {state === 'missing' && <p role="alert">Certificate not found.</p>}
    {state === 'error' && <p role="alert">Unable to load certificate detail.</p>}
    {state !== 'loading' && <button disabled={saving} onClick={() => { setSuccess(false); setAttempt(value => value + 1); }}>Reload certificate detail</button>}
    {success && <p role="status">Certificate revoked successfully.</p>}
    {state === 'ready' && detail && <>
      <dl>
        <dt>Serial number</dt><dd className="serial">{detail.serialNumber}</dd>
        <dt>Course</dt><dd>{detail.courseTitle}</dd>
        <dt>Learner</dt><dd>{detail.learnerName}</dd>
        <dt>Issue date</dt><dd><time dateTime={detail.issuedAt}>{localDateTime(detail.issuedAt, detail.issueTimeZone)}</time> ({detail.issueTimeZone})</dd>
        <dt>Status</dt><dd>{detail.status === 'active' ? 'Active' : 'Revoked'}</dd>
        {detail.revocationReason !== null && <><dt>Revocation reason</dt><dd>{detail.revocationReason}</dd></>}
      </dl>
      <h3>Audit history</h3>
      <ul>{detail.auditEvents.map(entry => <li key={entry.action}>
        {entry.action === 'ISSUED' ? 'Issued' : 'Revoked'} by {entry.actorName} — <time dateTime={entry.occurredAt}>{entry.occurredAt} (UTC)</time>
      </li>)}</ul>
      {detail.status === 'active' && <button onClick={() => { setReason(''); setSaveError(''); dialog.current?.showModal(); cancelButton.current?.focus(); }}>Revoke certificate</button>}
      {detail.status === 'revoked' && <p>Revocation is permanent. This certificate cannot be reissued.</p>}
    </>}
    <dialog ref={dialog} aria-labelledby="revoke-heading" aria-describedby="revoke-warning" onCancel={event => { if (saving) event.preventDefault(); }}>
      <form onSubmit={event => { void revoke(event); }}>
        <h3 id="revoke-heading">Confirm revocation</h3>
        <p className="serial">{detail?.serialNumber}</p>
        <p id="revoke-warning">Revocation is permanent. This certificate cannot be reissued. The action and your identity will be audited.</p>
        <label htmlFor="revocation-reason">Revocation reason</label>
        <textarea id="revocation-reason" value={reason} onChange={event => setReason(event.target.value)} required maxLength={1000} disabled={saving} />
        {saveError && <p role="alert">{saveError}</p>}
        {saving && <p role="status">Revoking certificate…</p>}
        <div className="controls">
          <button type="button" ref={cancelButton} disabled={saving} onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="submit" disabled={saving || !reason.trim()}>Confirm revocation</button>
        </div>
      </form>
    </dialog>
  </section>;
}
