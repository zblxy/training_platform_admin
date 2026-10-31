import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CertificateExport } from './CertificateExport';
import { isCertificateListResponse, type CertificateListResponse, type CertificateSortField } from '@training/shared';

import { CertificateDetail } from './CertificateDetail';

interface CertificateListProps { token: string; onTokenChange: (token: string) => void; refreshKey: number }
export function CertificateList({ token, onTokenChange: setToken, refreshKey }: CertificateListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const selectedTrigger = useRef<HTMLButtonElement | null>(null);
  const [revocationKey, setRevocationKey] = useState(0);
  const [credential, setCredential] = useState('');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<CertificateSortField>('issuedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [result, setResult] = useState<CertificateListResponse | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'unauthorized'>('idle');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setResult(null);
    if (!token) { setState('idle'); return; }
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setState('loading');
    const params = new URLSearchParams({ search, page: String(page), pageSize: String(pageSize), sortBy, sortDirection });
    void fetch(`/api/certificates?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { if (active) setState('unauthorized'); return; }
        if (!response.ok) throw new Error('Certificate request failed');
        const data: unknown = await response.json();
        if (!isCertificateListResponse(data)) throw new Error('Invalid certificate response');
        if (active) { setResult(data); setState('ready'); }
      }).catch(() => { if (active) setState('error'); }).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [token, search, page, pageSize, sortBy, sortDirection, attempt, refreshKey, revocationKey]);
  function applyToken(event: FormEvent) {
    event.preventDefault(); setSelectedId(null); setResult(null); setToken(credential.trim()); setCredential(''); setPage(1); setAttempt(value => value + 1);
  }
  function submitSearch(event: FormEvent) { event.preventDefault(); setSearch(draft.trim()); setPage(1); }
  const pages = result ? Math.max(1, Math.ceil(result.total / pageSize)) : 1;
  return <section aria-labelledby="certificates-heading">
    <h2 id="certificates-heading" ref={listHeading} tabIndex={-1}>Certificates</h2>
    <p>Search issued certificates by learner name or full serial number. Revoked certificates remain in the list.</p>
    <details open={!token}><summary>API token</summary>
      <form onSubmit={applyToken} className="controls">
        <label>Generated admin token<input type="password" value={credential} onChange={event => setCredential(event.target.value)} autoComplete="off" required minLength={43} maxLength={43} /></label>
        <button type="submit">Use token</button>
        {token && <button type="button" onClick={() => { setSelectedId(null); setToken(''); setResult(null); }}>Clear token</button>}
      </form>
      <p>Use your tenant admin token from the demo seed. The token stays in memory and is cleared on reload.</p>
    </details>
    <form onSubmit={submitSearch} className="controls" role="search">
      <label>Learner name or certificate serial number<input value={draft} onChange={event => setDraft(event.target.value)} maxLength={200} type="search" /></label>
      <button type="submit" disabled={!token}>Search</button>
      <button type="button" disabled={!token} onClick={() => { setDraft(''); setSearch(''); setPage(1); }}>Clear search</button>
    </form>
    <div className="controls">
      <label>Sort by<select value={sortBy} onChange={event => { setSortBy(event.target.value as CertificateSortField); setPage(1); }}>
        <option value="issuedAt">Issuance time</option><option value="learnerName">Learner name</option><option value="serialNumber">Serial number</option><option value="courseTitle">Course</option>
      </select></label>
      <label>Sort direction<select value={sortDirection} onChange={event => { setSortDirection(event.target.value as 'asc' | 'desc'); setPage(1); }}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
      <label>Rows per page<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
    </div>
    <CertificateExport key={token} token={token} filters={{ search, sortBy, sortDirection }} enabled={Boolean(token) && state === 'ready'} />
    <p role="status" aria-live="polite">{state === 'idle' ? 'Supply a generated admin token to load certificates.' : state === 'loading' ? 'Loading certificates…' : state === 'ready' ? `${result?.total ?? 0} certificates found.` : ''}</p>
    {state === 'unauthorized' && <p role="alert">The admin token is invalid or no longer authorized. Supply a valid token.</p>}
    {state === 'error' && <div role="alert">Unable to load certificates. <button onClick={() => setAttempt(value => value + 1)}>Retry certificates</button></div>}
    {state === 'ready' && result && <>
      {result.items.length === 0 ? <p>{result.total === 0 ? 'No certificates match your search.' : 'No certificates on this page. Return to an earlier page.'}</p> : <div className="table-scroll"><table>
        <caption>Issued certificates</caption>
        <thead><tr><th scope="col">Serial number</th><th scope="col">Learner</th><th scope="col">Course</th><th scope="col">Issue date</th><th scope="col">Status</th></tr></thead>
        <tbody>{result.items.map(item => <tr key={item.id}><td className="serial"><button onClick={event => { selectedTrigger.current = event.currentTarget; setSelectedId(item.id); }}>{item.serialNumber}</button></td><td>{item.learnerName}</td><td>{item.courseTitle}</td><td>{item.issueDate}</td><td>{item.status === 'active' ? 'Active' : 'Revoked'}</td></tr>)}</tbody>
      </table></div>}
      <nav aria-label="Certificate pagination" className="controls">
        <button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous page</button>
        <span>Page {page} of {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Next page</button>
        {page > pages && <button onClick={() => setPage(1)}>First page</button>}
      </nav>
    </>}
    {token && selectedId && <CertificateDetail key={`${token}:${selectedId}`} id={selectedId} token={token}
      onClose={() => { setSelectedId(null); (selectedTrigger.current?.isConnected ? selectedTrigger.current : listHeading.current)?.focus(); }}
      onRevoked={() => setRevocationKey(value => value + 1)} />}
  </section>;
}
