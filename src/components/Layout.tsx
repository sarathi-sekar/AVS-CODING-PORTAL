import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  UserCircle,
  Users,
  X,
  GraduationCap,
  BookOpen,
  Code2,
  ClipboardCheck,
  Briefcase,
  Gauge,
  Trophy,
  Award,
  FolderCog,
  Bookmark,
  Flame,
  Library as LibraryIcon,
  CalendarDays,
  BriefcaseBusiness,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL, type Role } from '../types';
import { Logo } from './Logo';
import { Avatar, Spinner } from './ui';
import { ThemeToggle } from './ThemeToggle';
import { usePendingUsers } from '../lib/usePendingUsers';

interface NavItem {
  badge?: 'pending';
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const STUDENT_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/practice', label: 'Practice', icon: Code2 },
  { to: '/tests', label: 'Tests', icon: ClipboardCheck },
  { to: '/library', label: 'Library', icon: LibraryIcon },
  { to: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/placement', label: 'Placement', icon: Briefcase },
  { to: '/skills', label: 'Skills', icon: Gauge },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/achievements', label: 'Achievements', icon: Award },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];
const STAFF_BASE: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/students', label: 'Students', icon: GraduationCap },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
];
const M_CONTENT: NavItem = { to: '/manage/content', label: 'Courses & videos', icon: FolderCog };
const M_QUESTIONS: NavItem = { to: '/manage/questions', label: 'Programming questions', icon: Code2 };
const M_TESTS: NavItem = { to: '/manage/assessments', label: 'Tests', icon: ClipboardCheck };
const M_LIBRARY: NavItem = { to: '/manage/library', label: 'Library', icon: LibraryIcon };
const M_JOBS: NavItem = { to: '/manage/jobs', label: 'Jobs & drives', icon: BriefcaseBusiness };
const M_SCHEDULE: NavItem = { to: '/manage/schedule', label: 'Schedule', icon: CalendarDays };
const M_CHALLENGES: NavItem = { to: '/manage/challenges', label: 'Challenges', icon: Flame };
const PROFILE: NavItem = { to: '/profile', label: 'Profile', icon: UserCircle };
const NAV: Record<Role, NavItem[]> = {
  student: STUDENT_NAV,
  faculty: [...STAFF_BASE, M_CONTENT, M_QUESTIONS, M_TESTS, M_LIBRARY, M_SCHEDULE, M_CHALLENGES, PROFILE],
  placement_coordinator: [...STAFF_BASE, M_TESTS, M_LIBRARY, M_JOBS, PROFILE],
  admin: [
    ...STAFF_BASE,
    { to: '/admin/users', label: 'Users', icon: Users, badge: 'pending' },
    { to: '/admin/departments', label: 'Academic setup', icon: Building2 },
    { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
    M_CONTENT, M_QUESTIONS, M_TESTS, M_LIBRARY, M_JOBS, M_SCHEDULE, M_CHALLENGES, PROFILE,
  ],
};

function AccountMenu({ placement }: { placement: 'rail' | 'header' }) {
  const { profile, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = profile?.displayName ?? user?.displayName ?? 'User';
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-11 w-11 items-center justify-center rounded-full"
      >
        <Avatar name={name} size={36} />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-50 w-64 rounded-xl border border-line bg-surface p-2 shadow-lg ${
            placement === 'rail' ? 'bottom-0 left-14' : 'right-0 top-12'
          }`}
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">{profile?.email ?? user?.email}</p>
            {profile && <p className="mt-1 text-xs text-brand-ink">{ROLE_LABEL[profile.role]}</p>}
          </div>
          <button
            role="menuitem"
            type="button"
            onClick={() => void logout()}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-sm text-ink hover:bg-subtle"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

function PendingBadge() {
  const { rows } = usePendingUsers();
  if (rows.length === 0) return null;
  return <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white" aria-label={`${rows.length} pending approvals`}>{rows.length > 9 ? '9+' : rows.length}</span>;
}

function RailLink({ item, onNavigate, labelled }: { item: NavItem; onNavigate?: () => void; labelled: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={item.label}
      aria-label={item.label}
      className={({ isActive }) =>
        `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium ${
          labelled ? 'w-full' : 'h-11 w-11 justify-center px-0'
        } ${isActive ? 'bg-brand-soft text-brand-ink' : 'text-muted hover:bg-subtle hover:text-ink'}`
      }
    >
      <span className="relative flex shrink-0"><Icon className="h-5 w-5" />{item.badge === 'pending' && <PendingBadge />}</span>
      {labelled && <span>{item.label}</span>}
    </NavLink>
  );
}

export function Layout({ children }: { children?: ReactNode }) {
  const { profile } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  const items = profile ? NAV[profile.role] : [];

  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawer]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[76px] flex-col items-center border-r border-line bg-surface py-4 lg:flex">
        <Logo className="h-12 w-12" />
        <p className="mt-6 text-[10px] font-semibold tracking-widest text-muted">MENU</p>
        <nav className="mt-2 flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Main">
          {items.map((i) => (
            <RailLink key={i.to} item={i} labelled={false} />
          ))}
        </nav>
        <div className="flex flex-col items-center gap-1 pt-2"><ThemeToggle /><AccountMenu placement="rail" /></div>
      </aside>

      {/* Mobile / tablet header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ink hover:bg-subtle"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Logo className="h-9 w-9" />
          <span className="truncate text-sm font-semibold">AVS Coding Portal</span>
        </div>
        <div className="flex items-center">
          <ThemeToggle />
          <AccountMenu placement="header" />
        </div>
      </header>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[78%] max-w-[300px] flex-col bg-surface p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Logo className="h-10 w-10" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">AVS Coding</p>
                  <p className="text-xs text-muted">& Programming Portal</p>
                </div>
              </div>
              <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-subtle">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Main">
              {items.map((i) => (
                <RailLink key={i.to} item={i} labelled onNavigate={() => setDrawer(false)} />
              ))}
            </nav>
          </div>
        </div>
      )}

      <main className="px-3 pb-10 pt-4 sm:px-6 sm:pt-6 lg:ml-[76px] lg:px-8">
        <div className="mx-auto w-full max-w-6xl">{children ?? <Suspense fallback={<Spinner />}><Outlet /></Suspense>}</div>
      </main>
    </div>
  );
}
