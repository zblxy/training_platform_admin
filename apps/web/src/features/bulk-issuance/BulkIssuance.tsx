import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isBulkIssuanceResponse, isCourseListResponse, type BulkIssuanceResponse, type CourseOption } from '@training/shared';

const reasons = { incomplete: 'Course not completed', already_issued: 'Certificate already issued', revoked: 'Certificate previously revoked', issuance_failed: 'Issuance failed; retry this course' };
export function BulkIssuance({ token, onComplete }: { token: string; onComplete: () => void }) {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseId, setCourseId] = useState('');
  const [courseState, setCourseState] = useState<'loading' | 'ready' | 'error' | 'unauthorized'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BulkIssuanceResponse | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let active = true;
    setCourseState('loading');
    void fetch('/api/certificates/courses', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { if (active) setCourseState('unauthorized'); return; }
        if (!response.ok) throw new Error('Course request failed');
        const data: unknown = await response.json();
        if (!isCourseListResponse(data)) throw new Error('Invalid courses');
        if (active) { setCourses(data.items); setCourseState('ready'); }
      }).catch(() => { if (active) setCourseState('error'); }).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [token, attempt]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !token || !courseId) return;
    submitting.current = true;
    setPending(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/certificates/bulk-issuance', { method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId }) });
      if (!mounted.current) return;
      if (response.status === 401) throw new Error('The admin token is invalid or no longer authorized.');
      if (response.status === 404) throw new Error('The selected course is no longer available. Reload courses and select again.');
      if (!response.ok) throw new Error('Unable to confirm issuance. Some certificates may have been issued. Retrying the course safely skips existing certificates.');
      const data: unknown = await response.json();
      if (!isBulkIssuanceResponse(data) || data.courseId !== courseId) throw new Error('Invalid issuance response. Some certificates may have been issued. Retrying safely skips existing certificates.');
      if (mounted.current) { setResult(data); onComplete(); }
    } catch (cause: unknown) {
      if (mounted.current) setError(cause instanceof Error && cause.message !== 'Failed to fetch' ? cause.message : 'Unable to confirm issuance. Some certificates may have been issued. Retrying safely skips existing certificates.');
    } finally {
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return <section aria-labelledby="bulk-issuance-heading">
    <h2 id="bulk-issuance-heading">Bulk issuance</h2>
    <p>Choose a course to issue certificates to all completed learners. Existing certificates, including revoked certificates, are skipped. Results stay available until you change course, token, or reload.</p>
    {!token ? <p>Supply an admin token above to choose a course.</p> : <>
      {courseState === 'loading' && <p role="status">Loading courses…</p>}
      {courseState === 'unauthorized' && <p role="alert">Supply a valid admin token to load courses.</p>}
      {courseState === 'error' && <p role="alert">Unable to load courses.</p>}
      <button type="button" disabled={pending || courseState === 'loading'} onClick={() => { setCourseId(''); setResult(null); setError(''); setAttempt(value => value + 1); }}>Reload courses</button>
      {courseState === 'ready' && (courses.length === 0 ? <p>No courses available.</p> : <form onSubmit={event => void submit(event)} className="controls" aria-busy={pending}>
        <label>Course<select value={courseId} disabled={pending} required onChange={event => { setCourseId(event.target.value); setResult(null); setError(''); }}>
          <option value="">Select a course</option>
          {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select></label>
        <button type="submit" disabled={pending || !courseId}>Issue to eligible learners</button>
      </form>)}
      <p role="status" aria-live="polite">{pending ? 'Issuing certificates… Keep this page open for results.' : result ? `Completed: ${result.issued} issued, ${result.skipped} skipped, ${result.failed} failed.` : ''}</p>
      {error && <p role="alert">{error}</p>}
      {result && (result.total === 0 ? <p>No learners are enrolled in this course.</p> : <div className="table-scroll"><table>
        <caption>Bulk issuance results</caption>
        <thead><tr><th scope="col">Learner</th><th scope="col">Outcome</th><th scope="col">Details</th></tr></thead>
        <tbody>{result.outcomes.map(outcome => <tr key={outcome.enrollmentId}><td>{outcome.learnerName}</td><td>{outcome.status}</td><td>{outcome.status === 'issued' ? outcome.serialNumber : reasons[outcome.reason]}</td></tr>)}</tbody>
      </table></div>)}
    </>}
  </section>;
}
