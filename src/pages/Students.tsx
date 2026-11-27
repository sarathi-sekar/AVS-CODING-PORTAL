import { useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import { Download, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { downloadCsv, toCsv } from '../lib/csv';
import { usePagedUsers } from '../lib/usePagedUsers';
import { ACADEMIC_YEARS } from '../types';
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';

export default function Students() {
  const constraints = useMemo(() => [where('role', '==', 'student'), where('status', '==', 'active')], []);
  const { rows, loading, hasMore, error, loadMore } = usePagedUsers(constraints, 'students', 'name');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');

  const departments = useMemo(() => [...new Set(rows.map((r) => r.department))].sort(), [rows]);
  const sections = useMemo(() => [...new Set(rows.map((r) => r.section))].sort(), [rows]);
  const filtered = rows.filter(
    (r) =>
      (!dept || r.department === dept) &&
      (!year || r.academicYear === year) &&
      (!section || r.section === section) &&
      (!q || r.displayName.toLowerCase().includes(q.toLowerCase()) || r.registerNumber.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <PageHeader title="Students" subtitle="Active students across all departments, years and sections." action={<button type="button" className="btn-outline" disabled={filtered.length === 0} onClick={() => downloadCsv(`students-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(['Name', 'Register number', 'Email', 'Department', 'Year', 'Section'], filtered.map((r) => [r.displayName, r.registerNumber, r.email, r.department, r.academicYear, r.section])))}><Download className="h-4 w-4" /> Export CSV</button>} />
      <div className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search name or register no." aria-label="Search students" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input" aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className="input" aria-label="Academic year" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All years</option>
          {ACADEMIC_YEARS.map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="input" aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">All sections</option>
          {sections.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {error && <ErrorNote message={error} />}
      <div className="card !p-0 overflow-hidden">
        <ul className="md:hidden">
          {filtered.map((r) => (
            <li key={r.uid} className="border-b border-line px-4 py-3 last:border-0"><Link className="block text-sm font-medium text-brand-ink" to={`/students/${r.uid}`}>{r.displayName}</Link><p className="text-xs text-muted">{r.registerNumber}</p><p className="mt-0.5 text-xs text-muted">{r.department} · {r.academicYear} · Sec {r.section}</p></li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-subtle text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Register no.</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Section</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.uid} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium"><Link className="text-brand-ink hover:underline" to={`/students/${r.uid}`}>{r.displayName}</Link></td>
                  <td className="px-4 py-3">{r.registerNumber}</td>
                  <td className="px-4 py-3">{r.department}</td>
                  <td className="px-4 py-3">{r.academicYear}</td>
                  <td className="px-4 py-3">{r.section}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <Spinner />}
        {!loading && filtered.length === 0 && <EmptyState title="No students found" hint="Students appear here after an admin approves their registration." />}
        {hasMore && !loading && (
          <div className="border-t border-line p-3 text-center">
            <button type="button" className="btn-outline" onClick={() => void loadMore()}>Load more</button>
          </div>
        )}
      </div>
    </>
  );
}
