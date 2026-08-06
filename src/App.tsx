'use client';

import {
  ArrowLeft,
  BadgeIndianRupee,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  History,
  Grid3X3,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Magnet,
  Menu,
  MessageSquare,
  Clock,
  Plus,
  Redo2,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Ruler,
  Undo2,
  Upload,
  Unlock,
  UserCog,
  UsersRound,
  WalletCards,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, PointerEvent, ReactNode } from 'react';
import { API_BASE_URL, ApiError, ApiNetworkError, ApiTimeoutError, apiDownload, apiRequest, sessionForStorage } from './api/client';
import {
  focusFormErrorFromMessage,
  setFormFieldError,
  useGlobalFormErrorNavigation,
} from './forms/useFormErrorNavigation';
import {
  nationalIndianMobileNumber,
  normalizeIndianPhone,
  normalizeOptionalIndianPhone,
  printableSlipSequence,
} from './features/slips/receipt-identifiers';

type PaymentMode = 'CASH' | 'UPI' | 'CHEQUE' | 'BANK_TRANSFER' | 'OTHER';
type TextAlign = 'left' | 'center' | 'right';
type TextWrapMode = 'single' | 'wrap' | 'shrink';
type TextDecoration = 'none' | 'underline' | 'line-through';
type UserRole = 'MANDAL_ADMIN' | 'KHAJINDAR' | 'GROUP_LEADER' | 'MEMBER' | 'SUPER_ADMIN';
type AdhyakshScreen = 'members' | 'tasks' | 'expenses' | 'template' | 'slips' | 'form' | 'users' | 'logs';
type OwnerScreen = 'dashboard' | 'mandals' | 'partners';
type OwnerMandalTab = 'overview' | 'template';
type Language = 'en' | 'mr' | 'hi';
type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type ThemedDialogRequest =
  | {
      cancelLabel?: string;
      confirmLabel?: string;
      danger?: boolean;
      message?: string;
      resolve: (value: boolean) => void;
      title: string;
      type: 'confirm';
    }
  | {
      cancelLabel?: string;
      confirmLabel?: string;
      danger?: boolean;
      defaultValue?: string;
      message?: string;
      multiline?: boolean;
      placeholder?: string;
      requiredValue?: string;
      resolve: (value: string | null) => void;
      title: string;
      type: 'prompt';
    };
type ThemedPromptOptions = Omit<Extract<ThemedDialogRequest, { type: 'prompt' }>, 'resolve' | 'type'>;

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <path d="M20.4 11.8a8.4 8.4 0 0 1-12.5 7.3L3.5 20.5l1.4-4.2A8.4 8.4 0 1 1 20.4 11.8Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M8.2 7.6c.2-.4.4-.4.7-.4h.4c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.7l-.6.7c-.2.2-.1.4 0 .6.7 1.2 1.6 2.1 2.8 2.7.3.1.5.1.7-.1l.8-1c.2-.2.4-.3.7-.2l1.9.9c.3.1.4.3.4.5 0 .5-.2 1.4-.7 1.8-.5.5-1.3.8-2.1.8-1 0-2.6-.5-4.4-2.1-2-1.8-3.2-4.1-3.3-5.4 0-.7.2-1.3.5-1.7Z" fill="currentColor" />
    </svg>
  );
}

interface TemplatePlacement {
  autoMarathi?: boolean;
  backgroundColor: string;
  borderColor: string;
  borderRadius: number;
  color: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: 'normal' | 'italic';
  fontWeight: number;
  height: number;
  letterSpacing: number;
  lineHeight: number;
  locked?: boolean;
  opacity: number;
  padding: number;
  rotate: number;
  script?: string;
  shadow: boolean;
  strikeout?: boolean;
  textAlign: TextAlign;
  textDecoration: TextDecoration;
  textTransform: 'none' | 'uppercase' | 'capitalize';
  textWrap: TextWrapMode;
  width: number;
  x: number;
  y: number;
}

interface TemplateAssetUpload {
  bucket: string | null;
  key: string | null;
  storage: 'inline' | 'supabase';
  url: string;
}

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: { id: string; mandalId: string | null; name: string; role: UserRole };
}

async function requestMarathiTranslation(
  text: string,
  session: AuthSession,
  signal: AbortSignal,
) {
  const response = await apiRequest<{ text: string }>(
    '/translation/marathi/transliterate',
    {
      body: JSON.stringify({ text: text.trim() }),
      method: 'POST',
      signal,
      timeoutMs: 2_500,
    },
    session,
  );
  return response.text.trim();
}

interface CustomField {
  dashboardFilter?: boolean;
  id: string;
  key: string;
  label: string;
  options?: string[];
  printOnSlip?: boolean;
  required: boolean;
  sortOrder: number;
  type: string;
}

type EntryFieldKey =
  | 'contributorName'
  | 'contributorNameMr'
  | 'shopName'
  | 'amount'
  | 'areaName'
  | 'groupId'
  | 'contributorAddress'
  | 'contributorAddressMr'
  | 'contributorPhone'
  | 'paymentStatus'
  | 'paymentMode'
  | 'tentativePaymentDate';

interface EntryFieldConfig {
  key: EntryFieldKey;
  label: string;
  required: boolean;
  locked?: boolean;
  type: string;
  visible: boolean;
}

const DEFAULT_ENTRY_FIELDS: EntryFieldConfig[] = [
  { key: 'contributorName', label: 'Name', required: true, locked: true, type: 'TEXT', visible: true },
  { key: 'contributorNameMr', label: 'Name on Marathi Slip', required: false, type: 'TEXT', visible: true },
  { key: 'shopName', label: 'Shop Name', required: false, type: 'TEXT', visible: true },
  { key: 'amount', label: 'Amount', required: true, locked: true, type: 'NUMBER', visible: true },
  { key: 'areaName', label: 'Location / Area', required: false, type: 'TEXT', visible: false },
  { key: 'groupId', label: 'Collection Group', required: false, type: 'DROPDOWN', visible: true },
  { key: 'contributorAddress', label: 'Address', required: false, type: 'LONG TEXT', visible: true },
  { key: 'contributorAddressMr', label: 'Address on Marathi Slip', required: false, type: 'LONG TEXT', visible: true },
  { key: 'contributorPhone', label: 'WhatsApp Number', required: false, type: 'PHONE', visible: true },
  { key: 'paymentStatus', label: 'Payment Status', required: true, locked: true, type: 'CHOICE', visible: true },
  { key: 'paymentMode', label: 'Payment Mode', required: true, type: 'DROPDOWN', visible: true },
  { key: 'tentativePaymentDate', label: 'Tentative Payment Date', required: false, type: 'DATE', visible: true },
];

function normalizeEntryFields(value: unknown): EntryFieldConfig[] {
  if (!Array.isArray(value)) return DEFAULT_ENTRY_FIELDS;
  return DEFAULT_ENTRY_FIELDS.map((fallback) => {
    const saved = value.find((item) => item && typeof item === 'object' && 'key' in item && item.key === fallback.key);
    if (!saved || typeof saved !== 'object') return fallback;
    const candidate = saved as Partial<EntryFieldConfig>;
    return {
      ...fallback,
      label: typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label.trim() : fallback.label,
      required: fallback.locked ? true : Boolean(candidate.required),
      visible: fallback.locked ? true : candidate.visible !== false,
    };
  });
}

interface Festival {
  endDate?: string;
  id: string;
  name: string;
  startDate?: string;
  status: string;
  templates?: Template[];
  targetAmount?: number | string | null;
  type: string;
}

interface Member {
  collectionTotal?: number | string | null;
  id: string;
  areaName?: string | null;
  displayName: string;
  paidSlipCount?: number;
  phone?: string | null;
  status?: string;
  group?: { id: string; name: string; areaName?: string | null } | null;
  groupId?: string | null;
  user?: { email?: string | null; id?: string; name: string; phone?: string | null; role: UserRole; status: string };
  userId?: string | null;
}

interface Group {
  collectionTotal?: number | string | null;
  id: string;
  areaName?: string | null;
  name: string;
  leader?: { id?: string; name: string; phone?: string | null } | null;
  members?: Member[];
  paidSlipCount?: number;
  _count?: { members: number; slips: number };
}

function getMemberUserId(member: Member) {
  return member.user?.id ?? member.userId ?? '';
}

function isActiveMember(member: Member) {
  return member.status !== 'ARCHIVED' && member.user?.status !== 'SUSPENDED';
}

function normalizeMemberResponse(response: Member | { member: Member; user?: Member['user'] }, groups: Group[]): Member {
  if (!('member' in response)) return response;
  const groupId = response.member.groupId ?? null;
  const group = groupId
    ? groups.find((item) => item.id === groupId) ?? response.member.group ?? null
    : null;
  return {
    ...response.member,
    group,
    user: response.user ?? response.member.user,
  };
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [item, ...items];
}

interface Slip {
  id: string;
  amount: string | number;
  areaName?: string | null;
  collector?: { id: string; name: string; phone?: string | null } | null;
  contributorAddress?: string | null;
  contributorName: string;
  contributorPhone?: string | null;
  collectedByUserId?: string | null;
  createdAt: string;
  customData?: Record<string, string>;
  groupId?: string | null;
  paymentMode: PaymentMode;
  receiptImageUrl?: string | null;
  shopName?: string | null;
  slipNumber: string;
  status?: string;
  whatsapp?: WhatsAppSendResult | null;
}

function isCollectorSession(session: AuthSession) {
  return session.user.role === 'MEMBER' || session.user.role === 'GROUP_LEADER';
}

function slipsVisibleToSession(items: Slip[], session: AuthSession) {
  if (!isCollectorSession(session)) return items;
  return items.filter((slip) => slip.collectedByUserId === session.user.id || slip.collector?.id === session.user.id);
}

interface WhatsAppSendResult {
  ok: boolean;
  provider?: 'AUTHKEY';
  reason?: string;
  receiptUrl?: string;
  status: 'failed' | 'sent' | 'skipped';
}

interface Template {
  id: string;
  name: string;
  status: string;
  versions: Array<{
    id: string;
    backgroundFileUrl: string;
    canvasHeight: number;
    canvasWidth: number;
    isActive: boolean;
    renderConfig?: { fields?: Record<string, Partial<TemplatePlacement>> };
    version: number;
  }>;
}

interface ActiveForm {
  customFields: CustomField[];
  festival: Festival;
  member?: Member | null;
}

interface CollectionReport {
  balance: number;
  byCollector?: Array<{ collectorName: string; slipCount: number; totalAmount: number }>;
  byPaymentMode?: Array<{ paymentMode: PaymentMode; slipCount: number; totalAmount: number }>;
  slipCount: number;
  totalCollection: number;
  totalExpenses: number;
}

interface Expense {
  id: string;
  amount: number | string;
  billFileUrl?: string | null;
  category?: { id: string; name: string } | null;
  categoryId?: string | null;
  createdAt?: string;
  creator?: { id: string; name: string } | null;
  expenseDate: string;
  notes?: string | null;
  status: ExpenseStatus;
  vendorName?: string | null;
}

interface FestivalTask {
  id: string;
  assignee?: { id: string; name: string; role: UserRole } | null;
  assigneeUserId?: string | null;
  dueDate?: string | null;
  group?: { id: string; name: string; areaName?: string | null } | null;
  groupId?: string | null;
  notes?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  title: string;
}

interface DemoMandal {
  _count?: { festivals?: number; members?: number; slips?: number };
  additionalMembers: string;
  address: string;
  adhyakshName: string;
  adminEmail?: string;
  adminPassword?: string;
  city: string;
  contactEmail?: string;
  contactName?: string;
  contactPhone: string;
  festivals?: Festival[];
  khajindarName: string;
  logoUrl?: string;
  locality: string;
  memberCount?: string;
  name: string;
  nameMr?: string;
  partner?: Partner | null;
  partnerId?: string | null;
  plan?: string;
  state?: string;
  id?: string;
  slug?: string;
  slipLimit?: number | null;
  status?: string;
  users?: MandalLoginUser[];
  whatsappMode?: 'AUTO_API' | 'MANUAL_SHARE';
  whatsappTemplateLanguage?: string | null;
  whatsappTemplateName?: string | null;
  whatsappTemplateVariableCount?: number | null;
  whatsappTemplateWid?: string | null;
}

interface PartnerMandalSummary {
  city?: string | null;
  contactPhone?: string | null;
  id: string;
  locality?: string | null;
  name: string;
  plan?: string | null;
  slug?: string | null;
  status?: string | null;
}

interface Partner {
  _count?: { mandals?: number };
  address?: string | null;
  createdAt?: string;
  email?: string | null;
  id: string;
  mandals?: PartnerMandalSummary[];
  name: string;
  phone?: string | null;
  status?: string;
}

interface AuthkeyWhatsAppTemplate {
  approved: boolean;
  body: string;
  category: string;
  compatible: boolean;
  language: string;
  name: string;
  rejectionReason?: string | null;
  variableCount: number;
  wid: string;
}

interface AuthkeyWhatsAppTemplateCatalog {
  cached: boolean;
  defaultWid: string | null;
  items: AuthkeyWhatsAppTemplate[];
  syncedAt: string;
}

interface MandalLoginUser {
  createdAt?: string;
  email?: string | null;
  id: string;
  name: string;
  phone?: string | null;
  role: UserRole;
  status: string;
}

interface WorkspaceUser {
  email: string;
  id: string;
  mandalId?: string | null;
  name: string;
  phone?: string | null;
  role: UserRole;
  status: string;
}

interface OwnerWorkspaceBootstrap {
  generatedAt: string;
  kind: 'OWNER';
  mandals: {
    items: Array<DemoMandal & { contactName?: string | null; contactPhone?: string | null; logoUrl?: string | null; festivals?: Festival[]; users?: MandalLoginUser[] }>;
    meta: { limit: number; page: number; total: number; totalPages: number };
  };
  partners?: Partner[];
  metrics: {
    totalMandals: number;
    totalMembers: number;
    totalSlips: number;
  };
  user?: WorkspaceUser | null;
}

interface MandalWorkspaceBootstrap {
  activeForm: ActiveForm | null;
  expenses?: Expense[];
  generatedAt: string;
  groups: Group[];
  kind: 'MANDAL';
  mandal?: DemoMandal | null;
  members: Member[];
  metrics?: Record<string, number>;
  report: CollectionReport | null;
  slips: { items: Slip[]; meta: { limit: number; page: number; total: number; totalPages: number } };
  tasks?: FestivalTask[];
  templates: Template[];
  user?: WorkspaceUser | null;
}

type WorkspaceBootstrap = OwnerWorkspaceBootstrap | MandalWorkspaceBootstrap;
type MandalMetrics = NonNullable<MandalWorkspaceBootstrap['metrics']>;
type SlipPageMeta = MandalWorkspaceBootstrap['slips']['meta'];
interface SlipListFilters {
  createdByUserId?: string;
  date?: string;
  search?: string;
  status?: 'ACTIVE' | 'PENDING';
}

const SESSION_KEY = 'digital-vargani-admin-session';
const SESSION_EXPIRED_EVENT = 'digital-vargani-session-expired';
const LANGUAGE_KEY = 'digital-vargani-language';
const WORKSPACE_CACHE_PREFIX = 'samavet:workspace-cache';
const DEFAULT_OWNER_IDENTIFIER = 'owner@digitalvargani.local';
const TEMPLATE_IMAGE = '/templates/default-vargani-receipt.svg';

const translations: Record<Exclude<Language, 'en'>, Record<string, string>> = {
  hi: {},
  mr: {},
};

const cleanTranslations: Record<Language, Record<string, string>> = {
  en: {},
  hi: {
    'Add Mandal': 'मंडल जोड़ें',
    'Add mandals and manage each client account.': 'मंडल जोड़ें और हर ग्राहक खाते को संभालें.',
    'Address': 'पता',
    'Adhyaksh Login': 'अध्यक्ष लॉगिन',
    'Back to Mandals': 'मंडल पर वापस',
    'Dashboard': 'डैशबोर्ड',
    'Digital Vargani': 'डिजिटल वर्गणी',
    'Generate Login': 'लॉगिन बनाएं',
    'Generate More Logins': 'और लॉगिन बनाएं',
    'Hindi': 'हिंदी',
    'Login URL': 'लॉगिन URL',
    'Logout': 'लॉग आउट',
    'Mandal name is required. Address, logo, contacts and member count are optional.': 'मंडल का नाम आवश्यक है. पता, लोगो, संपर्क और सदस्य संख्या वैकल्पिक हैं.',
    'Mandals': 'मंडल',
    'Marathi': 'मराठी',
    'Members': 'सदस्य',
    'Overview': 'अवलोकन',
    'Password': 'पासवर्ड',
    'Phone No.': 'फोन नंबर',
    'Save Template': 'टेम्पलेट सेव करें',
    'Saved': 'सेव हो गया',
    'Search': 'खोजें',
    'Search mandals by name, area, email...': 'नाम, क्षेत्र या ईमेल से मंडल खोजें...',
    'Slips Generated': 'बनी हुई पावती',
    'Slip Settings': 'पावती सेटिंग्स',
    'Slip Size': 'पावती आकार',
    'Super Admin Console': 'सुपर एडमिन कंसोल',
    'Template': 'टेम्पलेट',
    'Template Size': 'टेम्पलेट आकार',
    'Total Mandals': 'कुल मंडल',
    'Total Members': 'कुल सदस्य',
    'Upload Template': 'टेम्पलेट अपलोड करें',
    'Username': 'यूजरनेम',
    'Field Mapping': 'फील्ड मैपिंग',
    'Place boxes exactly on printed slip labels.': 'बॉक्स को छपी हुई पावती के लेबल पर ठीक से रखें.',
    'Selected Field': 'चुना हुआ फील्ड',
  },
  mr: {
    'Add Mandal': 'मंडळ जोडा',
    'Add mandals and manage each client account.': 'मंडळे जोडा आणि प्रत्येक ग्राहक खाते व्यवस्थापित करा.',
    'Address': 'पत्ता',
    'Adhyaksh Login': 'अध्यक्ष लॉगिन',
    'Back to Mandals': 'मंडळांकडे परत',
    'Dashboard': 'डॅशबोर्ड',
    'Digital Vargani': 'डिजिटल वर्गणी',
    'Generate Login': 'लॉगिन तयार करा',
    'Generate More Logins': 'अधिक लॉगिन तयार करा',
    'Hindi': 'हिंदी',
    'Login URL': 'लॉगिन URL',
    'Logout': 'लॉग आउट',
    'Mandal name is required. Address, logo, contacts and member count are optional.': 'मंडळाचे नाव आवश्यक आहे. पत्ता, लोगो, संपर्क आणि सदस्य संख्या ऐच्छिक आहेत.',
    'Mandals': 'मंडळे',
    'Marathi': 'मराठी',
    'Members': 'सदस्य',
    'Overview': 'आढावा',
    'Password': 'पासवर्ड',
    'Phone No.': 'फोन नंबर',
    'Save Template': 'टेम्पलेट सेव्ह करा',
    'Saved': 'सेव्ह झाले',
    'Search': 'शोधा',
    'Search mandals by name, area, email...': 'नाव, परिसर किंवा ईमेलने मंडळ शोधा...',
    'Slips Generated': 'तयार झालेल्या पावत्या',
    'Slip Settings': 'पावती सेटिंग्ज',
    'Slip Size': 'पावती आकार',
    'Super Admin Console': 'सुपर अॅडमिन कन्सोल',
    'Template': 'टेम्पलेट',
    'Template Size': 'टेम्पलेट आकार',
    'Total Mandals': 'एकूण मंडळे',
    'Total Members': 'एकूण सदस्य',
    'Upload Template': 'टेम्पलेट अपलोड करा',
    'Username': 'वापरकर्ता नाव',
    'Field Mapping': 'फील्ड मॅपिंग',
    'Place boxes exactly on printed slip labels.': 'बॉक्स छापलेल्या पावतीवरील लेबलवर अचूक ठेवा.',
    'Selected Field': 'निवडलेले फील्ड',
  },
};
function t(language: Language, text: string) {
  if (language === 'en') return text;
  return cleanTranslations[language][text] ?? translations[language][text] ?? text;
}

const slipBackgroundCache = new Map<string, Promise<HTMLImageElement>>();

function loadSlipBackground(url: string) {
  const cached = slipBackgroundCache.get(url);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => {
      slipBackgroundCache.delete(url);
      reject(new Error('Could not load slip background image'));
    };
    image.src = url;
  });
  if (slipBackgroundCache.size >= 6) {
    const oldest = slipBackgroundCache.keys().next().value;
    if (oldest) slipBackgroundCache.delete(oldest);
  }
  slipBackgroundCache.set(url, pending);
  return pending;
}

export default function App() {
  useGlobalFormErrorNavigation();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [slipMeta, setSlipMeta] = useState<SlipPageMeta>({ limit: 25, page: 1, total: 0, totalPages: 0 });
  const [workspaceMetrics, setWorkspaceMetrics] = useState<MandalMetrics>({});
  const [loadingMoreSlips, setLoadingMoreSlips] = useState(false);
  const [slipListFilters, setSlipListFilters] = useState<SlipListFilters>({});
  const [tasks, setTasks] = useState<FestivalTask[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [, setSelectedSlip] = useState<Slip | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string>(TEMPLATE_IMAGE);

  const handlePreviewChange = useCallback((url: string) => {
    setTemplatePreview(resolveTemplateAssetUrl(url));
  }, []);
  const [notice, setNotice] = useState('Login with main mandal admin to open the console.');
  const [authReady, setAuthReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState('');
  const [workspaceRefreshing, setWorkspaceRefreshing] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [yearChanging, setYearChanging] = useState(false);
  const [pendingFestivalYear, setPendingFestivalYear] = useState<number | null>(null);
  const [demoMandals, setDemoMandals] = useState<DemoMandal[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [currentMandal, setCurrentMandal] = useState<DemoMandal | null>(null);
  const [collectorModalOpen, setCollectorModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themedDialog, setThemedDialog] = useState<ThemedDialogRequest | null>(null);
  const whatsappWindowRef = useRef<Window | null>(null);
  const sessionRestoreStartedRef = useRef(false);
  const workspaceSyncTimerRef = useRef<number | null>(null);
  const workspaceSyncInFlightRef = useRef<Promise<void> | null>(null);
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    return stored === 'mr' || stored === 'hi' ? stored : 'en';
  });
  const [entryFields, setEntryFields] = useState<EntryFieldConfig[]>(DEFAULT_ENTRY_FIELDS);

  const mandalId = session?.user.mandalId;
  const festivalId = activeForm?.festival.id;
  const entryFieldsStorageKey = mandalId && festivalId
    ? `samavet:vargani-form:${mandalId}:${festivalId}`
    : '';
  const slipsListPath = useCallback((
    params: URLSearchParams,
    targetMandalId = mandalId,
    targetFestivalId = festivalId,
  ) => {
    const query = params.toString();
    const basePath = targetMandalId && targetFestivalId
      ? `/mandals/${targetMandalId}/festivals/${targetFestivalId}/vargani/slips`
      : '/vargani/slips';
    return query ? `${basePath}?${query}` : basePath;
  }, [festivalId, mandalId]);

  useEffect(() => {
    if (!entryFieldsStorageKey) {
      setEntryFields(DEFAULT_ENTRY_FIELDS);
      return;
    }
    try {
      const stored = window.localStorage.getItem(entryFieldsStorageKey);
      let fields = stored ? normalizeEntryFields(JSON.parse(stored)) : DEFAULT_ENTRY_FIELDS;
      const locationRemovalKey = `${entryFieldsStorageKey}:location-removed-v1`;
      if (!window.localStorage.getItem(locationRemovalKey)) {
        fields = fields.map((field) => field.key === 'areaName'
          ? { ...field, required: false, visible: false }
          : field);
        window.localStorage.setItem(entryFieldsStorageKey, JSON.stringify(fields));
        window.localStorage.setItem(locationRemovalKey, '1');
      }
      setEntryFields(fields);
    } catch {
      setEntryFields(DEFAULT_ENTRY_FIELDS);
    }
  }, [entryFieldsStorageKey]);

  function updateEntryField(key: EntryFieldKey, patch: Partial<EntryFieldConfig>) {
    setEntryFields((current) => {
      const next = current.map((field) => {
        if (field.key !== key) return field;
        return {
          ...field,
          ...patch,
          key: field.key,
          locked: field.locked,
          required: field.locked ? true : patch.required ?? field.required,
          visible: field.locked ? true : patch.visible ?? field.visible,
        };
      });
      if (entryFieldsStorageKey) {
        window.localStorage.setItem(entryFieldsStorageKey, JSON.stringify(next));
      }
      return next;
    });
  }

  const activeTemplate = templates.find((template) =>
    template.versions.some((version) => version.isActive),
  );
  const latestTemplateVersion = activeTemplate?.versions.find((version) => version.isActive);
  useEffect(() => {
    if (sessionRestoreStartedRef.current) return;
    sessionRestoreStartedRef.current = true;

    void (async () => {
      const stored = window.localStorage.getItem(SESSION_KEY);
      if (!stored) {
        setAuthReady(true);
        return;
      }

      try {
        const parsed = JSON.parse(stored) as AuthSession;
        // One-time migration: remove credentials persisted by older releases
        // while retaining the in-memory token long enough to rotate the session.
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionForStorage(parsed)));
        setSession(parsed);
        const cachedWorkspace = readWorkspaceCache(parsed);
        if (cachedWorkspace) {
          queryClient.setQueryData(workspaceQueryKey(parsed), cachedWorkspace);
          applyWorkspaceBootstrap(cachedWorkspace, parsed);
          setNotice('Showing saved data while checking for updates...');
        }
        setAuthReady(true);
        await restoreSession(parsed, Boolean(cachedWorkspace));
      } catch {
        window.localStorage.removeItem(SESSION_KEY);
        setSession(null);
        setNotice('Session expired. Login again to continue.');
      } finally {
        setAuthReady(true);
      }
    })();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session || !authReady) return;
    if (process.env.NODE_ENV === 'development') return;

    // Start DNS/TLS negotiation and establish a database connection while the
    // user is typing. This is intentionally fire-and-forget: login never waits
    // for the warm-up request and remains fully functional if it fails.
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);
    void fetch(`${API_BASE_URL}/health/ready`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).catch(() => undefined).finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [authReady, session]);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_KEY, language);
    document.documentElement.lang = language === 'mr' ? 'mr' : language === 'hi' ? 'hi' : 'en';
  }, [language]);

  useEffect(() => {
    function handleSessionExpired() {
      queryClient.clear();
      setSession(null);
      setActiveForm(null);
      setGroups([]);
      setMembers([]);
      setCurrentMandal(null);
      setExpenses([]);
      setSlips([]);
      setSlipMeta({ limit: 25, page: 1, total: 0, totalPages: 0 });
      setWorkspaceMetrics({});
      setTasks([]);
      setTemplates([]);
      setSelectedSlip(null);
      setWorkspaceLoaded(false);
      setPartners([]);
      setNotice('Session expired. Login again to continue.');
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [queryClient]);

  function startBusy(message = 'Loading') {
    setBusyMessage(message);
    setBusy(true);
  }

  function stopBusy() {
    setBusy(false);
    setBusyMessage('');
  }

  function askConfirm(options: Omit<Extract<ThemedDialogRequest, { type: 'confirm' }>, 'resolve' | 'type'>) {
    return new Promise<boolean>((resolve) => {
      setThemedDialog({
        ...options,
        resolve,
        type: 'confirm',
      });
    });
  }

  function askPrompt(options: ThemedPromptOptions) {
    return new Promise<string | null>((resolve) => {
      setThemedDialog({
        ...options,
        resolve,
        type: 'prompt',
      });
    });
  }

  function closeThemedDialog(value?: boolean | string | null) {
    const dialog = themedDialog;
    setThemedDialog(null);
    if (!dialog) return;
    if (dialog.type === 'confirm') {
      dialog.resolve(Boolean(value));
      return;
    }
    dialog.resolve(typeof value === 'string' ? value : null);
  }

  async function saveTemplateConfig(
    placements: Record<string, TemplatePlacement>,
    target?: { festivalId?: string; mandalId?: string; previewUrl?: string },
  ) {
    if (!session) throw new Error('Login is required to save template.');
    startBusy('Saving template...');
    try {
      const targetMandalId = target?.mandalId ?? mandalId;
      let targetFestivalId = target?.festivalId ?? festivalId;
      if (targetMandalId && !targetFestivalId) {
        const workspace = await apiRequest<WorkspaceBootstrap>('/workspace/bootstrap', {}, session);
        queryClient.setQueryData(workspaceQueryKey(session), workspace);
        applyWorkspaceBootstrap(workspace, session);
        if (workspace.kind === 'MANDAL') {
          targetFestivalId = workspace.activeForm?.festival.id;
        } else {
          const refreshedMandal = workspace.mandals.items.find((mandal) => mandal.id === targetMandalId);
          targetFestivalId = refreshedMandal?.festivals?.[0]?.id;
        }
      }
      if (!targetMandalId || !targetFestivalId) {
        throw new Error('Active mandal festival not found. Open this mandal again and try saving.');
      }

      const backgroundFileUrl = await persistTemplatePreview(targetMandalId, targetFestivalId, target?.previewUrl);

      await apiRequest(
        `/mandals/${targetMandalId}/festivals/${targetFestivalId}/templates/active-version`,
        {
          body: JSON.stringify({
            backgroundFileUrl,
            canvasHeight: 800,
            canvasWidth: 1328,
            name: 'Vargani Receipt Template',
            renderConfig: { fields: placements },
          }),
          method: 'PUT',
        },
        session,
      );

      setNotice('Template saved to backend successfully.');
      // The saved response is authoritative. Reconcile the rest of the workspace
      // later so saving is not held up by another full bootstrap request.
      scheduleWorkspaceSync(session);
    } finally {
      stopBusy();
    }
  }

  async function persistTemplatePreview(targetMandalId: string, targetFestivalId: string, previewOverride?: string) {
    const preview = previewOverride || templatePreview || TEMPLATE_IMAGE;
    if (!preview.startsWith('data:')) return resolveTemplateAssetUrl(preview);

    const asset = await apiRequest<TemplateAssetUpload>(
      `/mandals/${targetMandalId}/festivals/${targetFestivalId}/templates/assets`,
      {
        body: JSON.stringify({
          dataUrl: preview,
          fileName: `vargani-template-${Date.now()}.png`,
        }),
        method: 'POST',
      },
      session,
    );

    setTemplatePreview(asset.url);
    return asset.url;
  }

  async function createCustomField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !session.user.mandalId || !activeForm) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const label = String(form.get('label') || '').trim();
    const type = String(form.get('type') || 'TEXT');
    const options = String(form.get('options') || '')
      .split(',')
      .map((option) => option.trim())
      .filter(Boolean);

    if (!label) {
      setNotice('Enter a field label before adding it.');
      setFormFieldError(formElement, 'label', 'Enter a field label before adding it.');
      return;
    }

    try {
      const field = await apiRequest<CustomField>(
        `/mandals/${session.user.mandalId}/festivals/${activeForm.festival.id}/custom-fields`,
        {
          body: JSON.stringify({
            dashboardFilter: form.get('dashboardFilter') === 'on',
            label,
            options: type === 'DROPDOWN' ? options : undefined,
            printOnSlip: form.get('printOnSlip') === 'on',
            required: form.get('required') === 'on',
            sortOrder: (activeForm.customFields?.length ?? 0) + 1,
            type,
          }),
          method: 'POST',
        },
        session,
      );
      setActiveForm((current) => current
        ? { ...current, customFields: [...(current.customFields ?? []), field] }
        : current);
      formElement.reset();
      setNotice('Form question added.');
      scheduleWorkspaceSync(session);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not add form question.');
      focusFormErrorFromMessage(formElement, error);
    }
  }

  async function updateCustomField(field: CustomField, patch: Partial<CustomField>) {
    if (!session || !session.user.mandalId || !activeForm) return;

    try {
      const updatedField = await apiRequest<CustomField>(
        `/mandals/${session.user.mandalId}/festivals/${activeForm.festival.id}/custom-fields/${field.id}`,
        {
          body: JSON.stringify(patch),
          method: 'PATCH',
        },
        session,
      );
      setActiveForm((current) => current
        ? {
            ...current,
            customFields: current.customFields.map((item) => (item.id === field.id ? updatedField : item)),
          }
        : current);
      setNotice('Form question updated.');
      scheduleWorkspaceSync(session);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update form question.');
    }
  }

  async function deleteCustomField(field: CustomField) {
    if (!session || !session.user.mandalId || !activeForm) return;
    const confirmed = await askConfirm({
      confirmLabel: 'Delete Question',
      danger: true,
      message: `Existing slips will keep old data for "${field.label}".`,
      title: 'Delete form question?',
    });
    if (!confirmed) return;

    try {
      await apiRequest(
        `/mandals/${session.user.mandalId}/festivals/${activeForm.festival.id}/custom-fields/${field.id}`,
        { method: 'DELETE' },
        session,
      );
      setActiveForm((current) => current
        ? { ...current, customFields: current.customFields.filter((item) => item.id !== field.id) }
        : current);
      setNotice('Form question deleted.');
      scheduleWorkspaceSync(session);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete form question.');
    }
  }

  function applyWorkspaceBootstrap(payload: WorkspaceBootstrap, currentSession = session) {
    if (payload.kind === 'OWNER') {
      const ownerMandals = payload.mandals.items.map(mapBackendMandal);
      setActiveForm(null);
      setGroups([]);
      setMembers([]);
      setExpenses([]);
      setSlips([]);
      setSlipMeta({ limit: 25, page: 1, total: 0, totalPages: 0 });
      setWorkspaceMetrics({});
      setTasks([]);
      setTemplates([]);
      setSelectedSlip(null);
      setDemoMandals(ownerMandals);
      setPartners(payload.partners ?? []);
      setCurrentMandal(null);
      setWorkspaceLoaded(true);
      return;
    }

    const activeMembers = payload.members.filter(isActiveMember);
    const activeUserIds = new Set(activeMembers.map(getMemberUserId).filter(Boolean));
    const activeGroups = payload.groups.map((group) => {
      const members = (group.members ?? []).filter(isActiveMember);
      const leader = group.leader?.id && !activeUserIds.has(group.leader.id) ? null : group.leader;
      return {
        ...group,
        leader,
        members,
        _count: group._count ? { ...group._count, members: members.length } : group._count,
      };
    });
    const nextSlips = currentSession ? slipsVisibleToSession(payload.slips.items, currentSession) : payload.slips.items;
    setCurrentMandal(payload.mandal ? mapBackendMandal(payload.mandal) : null);
    setActiveForm(payload.activeForm);
    setGroups(activeGroups);
    setMembers(activeMembers);
    setExpenses(payload.expenses ?? []);
    setSlips(nextSlips);
    setSlipMeta(payload.slips.meta);
    setWorkspaceMetrics(payload.metrics ?? {});
    setSlipListFilters({});
    setTasks(payload.tasks ?? []);
    setTemplates(payload.templates);
    setSelectedSlip(nextSlips[0] ?? null);
    const activeVersion = findActiveTemplateVersion(payload.templates);
    setTemplatePreview(resolveTemplateAssetUrl(activeVersion?.backgroundFileUrl || TEMPLATE_IMAGE));
    setDemoMandals([]);
    setPartners([]);
    setWorkspaceLoaded(true);
  }

  function prepareWhatsAppWindow(paymentStatus: 'ACTIVE' | 'PENDING') {
    void paymentStatus;
    whatsappWindowRef.current?.close();
    whatsappWindowRef.current = null;
  }

  async function createReceiptShare(slip: Slip, phone?: string | null, manual = false) {
    if (!session || !isSlipPaid(slip)) return null;
    return apiRequest<{ auditEventId: string; expiresAt: string; ok: boolean; receiptUrl: string; sharedAt: string; whatsapp?: WhatsAppSendResult }>(
      `/vargani/slips/${slip.id}/share`,
      {
        body: JSON.stringify({
          channel: manual ? 'MANUAL_WHATSAPP' : 'WHATSAPP',
          phone: normalizeIndianPhone(phone ?? slip.contributorPhone),
        }),
        method: 'POST',
      },
      session,
    );
  }

  async function uploadRenderedSlipImage(slip: Slip) {
    if (!session) throw new Error('Login again to upload receipt image.');
    const blob = await renderSlipJpegBlob(slip);
    const formData = new FormData();
    formData.append('file', blob, `${slip.slipNumber || slip.id}.jpg`);
    const upload = await apiRequest<{
      ok: boolean;
      receiptImageUrl: string;
      share?: { whatsapp?: WhatsAppSendResult };
      storage: string;
    }>(
      `/vargani/slips/${slip.id}/receipt-image-file?autoShare=true`,
      {
        body: formData,
        method: 'POST',
      },
      session,
    );
    setSlips((current) =>
      current.map((item) => (item.id === slip.id ? { ...item, receiptImageUrl: upload.receiptImageUrl } : item)),
    );
    setSelectedSlip((current) =>
      current?.id === slip.id ? { ...current, receiptImageUrl: upload.receiptImageUrl } : current,
    );
    return upload;
  }

  async function restoreSession(storedSession: AuthSession, hasCachedWorkspace = false) {
    let nextSession = storedSession;
    if (!storedSession.accessToken) {
      nextSession = await apiRequest<AuthSession>(
        '/auth/refresh',
        { body: JSON.stringify({}), method: 'POST' },
        storedSession,
      );
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionForStorage(nextSession)));
    }
    setSession(nextSession);
    if (!hasCachedWorkspace) setWorkspaceLoaded(false);
    await loadWorkspace(nextSession);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const identifier = String(form.get('identifier') || '').trim();
    const password = String(form.get('password') || '');

    if (!identifier) {
      setNotice('Enter your username.');
      setFormFieldError(formElement, 'identifier', 'Enter your username.');
      return;
    }
    if (password.length < 8) {
      setNotice('Password must contain at least 8 characters.');
      setFormFieldError(formElement, 'password', 'Password must contain at least 8 characters.');
      return;
    }

    const performLogin = () => apiRequest<AuthSession>('/auth/login', {
      body: JSON.stringify({
        identifier,
        password,
      }),
      method: 'POST',
      timeoutMs: 30_000,
    });

    setNotice('');
    setLoginBusy(true);
    try {
      const nextSession = await performLogin();
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionForStorage(nextSession)));
      setWorkspaceLoaded(false);
      setNotice('');
      // Authentication is the only blocking step. Open the correct role-based
      // shell immediately, then hydrate its data without another full-screen
      // loader or extending the "Signing in" state.
      setSession(nextSession);
      void loadWorkspace(nextSession);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setNotice('Incorrect username or password.');
      } else if (error instanceof ApiError && error.status === 429) {
        setNotice('Too many login attempts. Please wait a minute and try again.');
      } else if (error instanceof ApiError && error.status >= 500) {
        setNotice('Login service is temporarily busy. Please try again shortly.');
      } else if (error instanceof ApiTimeoutError || error instanceof ApiNetworkError) {
        setNotice('Could not reach the login service. Check your connection and try again.');
      } else {
        setNotice(error instanceof Error ? error.message : 'Could not log in. Please try again.');
      }
      focusFormErrorFromMessage(formElement, error);
    } finally {
      setLoginBusy(false);
    }
  }

  function logout() {
    const endingSession = session;
    if (workspaceSyncTimerRef.current !== null) {
      window.clearTimeout(workspaceSyncTimerRef.current);
      workspaceSyncTimerRef.current = null;
    }
    if (endingSession) {
      window.localStorage.removeItem(workspaceCacheKey(endingSession));
      // Make logout instant locally. Server-side token revocation does not need to
      // block navigation and keepalive lets it finish during page transitions.
      void apiRequest('/auth/logout', { keepalive: true, method: 'POST' }, endingSession).catch(() => undefined);
    }
    sessionRestoreStartedRef.current = false;
    window.localStorage.removeItem(SESSION_KEY);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    queryClient.clear();
    setSession(null);
    setActiveForm(null);
    setGroups([]);
    setMembers([]);
    setCurrentMandal(null);
    setExpenses([]);
    setSlips([]);
    setSlipMeta({ limit: 25, page: 1, total: 0, totalPages: 0 });
    setWorkspaceMetrics({});
    setTasks([]);
    setTemplates([]);
    setSelectedSlip(null);
    setWorkspaceLoaded(false);
    setPartners([]);
    setNotice('Logged out. Login again to use the console.');
    setWorkspaceRefreshing(false);
  }

  async function syncWorkspaceQuietly(currentSession = session) {
    if (!currentSession) return;
    if (workspaceSyncInFlightRef.current) return workspaceSyncInFlightRef.current;
    const sync = (async () => {
      try {
        const summaryRequest = apiRequest<{ kind: 'MANDAL' | 'OWNER'; metrics: Record<string, number> }>(
          '/workspace/summary',
          {},
          currentSession,
        );
        const detailsRequest = currentSession.user.mandalId && festivalId
          ? refreshLiveCollections(currentSession, currentSession.user.mandalId, festivalId)
          : Promise.resolve();
        const [summary] = await Promise.all([summaryRequest, detailsRequest]);
        if (summary.kind === 'MANDAL') setWorkspaceMetrics(summary.metrics);
      } catch {
        // Keep optimistic state and retry on the next focus/poll cycle.
      }
    })().finally(() => {
      workspaceSyncInFlightRef.current = null;
    });
    workspaceSyncInFlightRef.current = sync;
    return sync;
  }

  async function refreshLiveCollections(currentSession: AuthSession, currentMandalId: string, currentFestivalId: string) {
    const festivalPath = `/mandals/${currentMandalId}/festivals/${currentFestivalId}`;
    const isCollectorSession = currentSession.user.role === 'MEMBER' || currentSession.user.role === 'GROUP_LEADER';
    const shouldRefreshSlips = !Object.values(slipListFilters).some(Boolean);
    const [latestSlips, liveTasks, liveExpenses] = await Promise.all([
      shouldRefreshSlips
        ? apiRequest<{ items: Slip[]; meta: SlipPageMeta }>(
            slipsListPath(new URLSearchParams({ limit: '25', page: '1' }), currentMandalId, currentFestivalId),
            {},
            currentSession,
          )
        : Promise.resolve(null),
      apiRequest<FestivalTask[]>(`${festivalPath}/tasks`, {}, currentSession),
      isCollectorSession
        ? Promise.resolve([])
        : apiRequest<Expense[]>(`${festivalPath}/expenses`, {}, currentSession),
    ]);

    if (latestSlips) {
      setSlips((current) => {
        const visibleLatest = slipsVisibleToSession(latestSlips.items, currentSession);
        const latestIds = new Set(visibleLatest.map((slip) => slip.id));
        const retained = slipsVisibleToSession(current, currentSession).filter((slip) => !latestIds.has(slip.id));
        return [...visibleLatest, ...retained].slice(0, Math.max(25, retained.length + visibleLatest.length));
      });
      setSlipMeta(latestSlips.meta);
    }
    setTasks(liveTasks);
    setExpenses(liveExpenses);
  }

  function scheduleWorkspaceSync(currentSession = session, delay = 750) {
    if (!currentSession) return;
    if (workspaceSyncTimerRef.current !== null) window.clearTimeout(workspaceSyncTimerRef.current);
    workspaceSyncTimerRef.current = window.setTimeout(() => {
      workspaceSyncTimerRef.current = null;
      void syncWorkspaceQuietly(currentSession);
    }, delay);
  }

  useEffect(() => {
    if (!session || !workspaceLoaded) return;
    const refreshWhenActive = () => {
      if (document.visibilityState === 'visible') void syncWorkspaceQuietly(session);
    };
    const timer = window.setInterval(refreshWhenActive, 30_000);
    window.addEventListener('focus', refreshWhenActive);
    document.addEventListener('visibilitychange', refreshWhenActive);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWhenActive);
      document.removeEventListener('visibilitychange', refreshWhenActive);
    };
    // The polling fallback is scoped to the authenticated workspace identity.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [festivalId, session, workspaceLoaded]);

  async function loadMoreSlips() {
    if (!session || loadingMoreSlips || slipMeta.page >= slipMeta.totalPages) return;
    setLoadingMoreSlips(true);
    try {
      const params = new URLSearchParams({ limit: String(slipMeta.limit), page: String(slipMeta.page + 1) });
      Object.entries(slipListFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
      const nextPage = await apiRequest<{ items: Slip[]; meta: SlipPageMeta }>(
        slipsListPath(params),
        {},
        session,
      );
      const visibleNextItems = slipsVisibleToSession(nextPage.items, session);
      setSlips((current) => {
        const knownIds = new Set(current.map((slip) => slip.id));
        return [
          ...slipsVisibleToSession(current, session),
          ...visibleNextItems.filter((slip) => !knownIds.has(slip.id)),
        ];
      });
      setSlipMeta(nextPage.meta);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load more slips.');
    } finally {
      setLoadingMoreSlips(false);
    }
  }

  const filterSlips = useCallback(async (filters: SlipListFilters) => {
    if (!session) return;
    setLoadingMoreSlips(true);
    try {
      const params = new URLSearchParams({ limit: '25', page: '1' });
      Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
      const page = await apiRequest<{ items: Slip[]; meta: SlipPageMeta }>(
        slipsListPath(params),
        {},
        session,
      );
      setSlipListFilters(filters);
      setSlips(slipsVisibleToSession(page.items, session));
      setSlipMeta(page.meta);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not filter slips.');
    } finally {
      setLoadingMoreSlips(false);
    }
  }, [session, slipsListPath]);

  async function loadWorkspace(currentSession = session) {
    if (!currentSession) return;
    setWorkspaceRefreshing(true);
    try {
      const workspace = await apiRequest<WorkspaceBootstrap>('/workspace/bootstrap', {}, currentSession);
      queryClient.setQueryData(workspaceQueryKey(currentSession), workspace);
      writeWorkspaceCache(currentSession, workspace);
      applyWorkspaceBootstrap(workspace, currentSession);
      void hydrateWorkspaceDetails(currentSession, workspace);
      setNotice(
        workspace.kind === 'OWNER'
          ? 'Owner workspace loaded. Manage all onboarded mandals from here.'
          : 'Live mandal data loaded from Supabase.',
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load workspace.');
    } finally {
      setWorkspaceRefreshing(false);
    }
  }

  async function hydrateWorkspaceDetails(currentSession: AuthSession, workspace: WorkspaceBootstrap) {
    if (workspace.kind !== 'MANDAL' || !currentSession.user.mandalId || !workspace.activeForm?.festival.id) return;
    const festivalPath = `/mandals/${currentSession.user.mandalId}/festivals/${workspace.activeForm.festival.id}`;
    const isCollectorSession = currentSession.user.role === 'MEMBER' || currentSession.user.role === 'GROUP_LEADER';

    try {
      if (isCollectorSession) {
        const liveTasks = await apiRequest<FestivalTask[]>(`${festivalPath}/tasks`, {}, currentSession);
        setExpenses([]);
        setTasks(liveTasks);
        return;
      }

      const [liveExpenses, liveTasks] = await Promise.all([
        apiRequest<Expense[]>(`${festivalPath}/expenses`, {}, currentSession),
        apiRequest<FestivalTask[]>(`${festivalPath}/tasks`, {}, currentSession),
      ]);
      setExpenses(liveExpenses);
      setTasks(liveTasks);
    } catch {
      // The bootstrap is enough to open the app. Secondary cards can refresh
      // quietly without blocking sign-in or covering the workspace.
    }
  }

  async function changeFestivalYear(year: number) {
    if (!session?.user.mandalId || yearChanging) return;
    if (festivalYear(activeForm?.festival) === year) return;

    const currentSession = session;
    const currentMandalId = session.user.mandalId;
    setPendingFestivalYear(year);
    setYearChanging(true);
    setNotice(`Switching to Year ${year}...`);
    try {
      const activatedFestival = await apiRequest<Festival>(
        `/mandals/${session.user.mandalId}/festivals/years/${year}/activate`,
        { method: 'POST', timeoutMs: 30_000 },
        session,
      );
      setActiveForm((current) => current
        ? { ...current, festival: activatedFestival }
        : { customFields: [], festival: activatedFestival });
      setSlips([]);
      setSlipMeta({ limit: 25, page: 1, total: 0, totalPages: 0 });
      setSlipListFilters({});
      setSelectedSlip(null);
      setTasks([]);
      setExpenses([]);
      setWorkspaceMetrics({});
      setNotice(`Year ${year} is active. Entries are saved separately for this year.`);

      void (async () => {
        try {
          const summaryRequest = apiRequest<{ kind: 'MANDAL' | 'OWNER'; metrics: Record<string, number> }>(
            '/workspace/summary',
            {},
            currentSession,
          );
          const detailsRequest = refreshLiveCollections(currentSession, currentMandalId, activatedFestival.id);
          const [summary] = await Promise.all([summaryRequest, detailsRequest]);
          if (summary.kind === 'MANDAL') setWorkspaceMetrics(summary.metrics);

          const workspace = await apiRequest<WorkspaceBootstrap>('/workspace/bootstrap', {}, currentSession);
          queryClient.setQueryData(workspaceQueryKey(currentSession), workspace);
          writeWorkspaceCache(currentSession, workspace);
          applyWorkspaceBootstrap(workspace, currentSession);
          void hydrateWorkspaceDetails(currentSession, workspace);
        } catch {
          scheduleWorkspaceSync(currentSession, 1_500);
        }
      })();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `Could not open Year ${year}.`);
    } finally {
      setPendingFestivalYear(null);
      setYearChanging(false);
    }
  }

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !mandalId || !festivalId) return false;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const password = String(form.get('password') || '');
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim().toLowerCase();
    const rawPhone = String(form.get('phone') || '').trim();
    const normalizedPhone = normalizeIndianPhone(rawPhone);
    if (password.length < 8) {
      setNotice('Member password must contain at least 8 characters.');
      setFormFieldError(formElement, 'password', 'Member password must contain at least 8 characters.');
      return false;
    }
    if (rawPhone && !/^91[6-9]\d{9}$/.test(normalizedPhone)) {
      setNotice('Enter a valid 10-digit Indian mobile number, for example 9876543210.');
      setFormFieldError(formElement, 'phone', 'Enter a valid 10-digit Indian mobile number, for example 9876543210.');
      return false;
    }
    try {
      const response = await apiRequest<Member | { member: Member; user?: Member['user'] }>(
        `/mandals/${mandalId}/festivals/${festivalId}/members`,
        {
          body: JSON.stringify({
            areaName: String(form.get('areaName') || '').trim() || undefined,
            email,
            groupId: String(form.get('groupId') || '') || undefined,
            name,
            password,
            phone: normalizedPhone ? `+${normalizedPhone}` : undefined,
            role: 'MEMBER' satisfies UserRole,
          }),
          method: 'POST',
        },
        session,
      );
      const member = normalizeMemberResponse(response, groups);
      setMembers((current) => upsertById(current, member));
      formElement.reset();
      setNotice('Member login created successfully.');
      scheduleWorkspaceSync(session);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create member login.');
      focusFormErrorFromMessage(formElement, error);
      return false;
    }
  }

  async function createMandal(event: FormEvent<HTMLFormElement>): Promise<{ id?: string; ok: boolean }> {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const logo = form.get('logo');
    const generatedPassword = generateTemporaryPassword();
    const mandalName = String(form.get('name') || '').trim();
    const adminPassword = String(form.get('adminPassword') || generatedPassword);
    const contactPhone = normalizeOptionalIndianPhone(String(form.get('contactPhone') || ''));
    let logoDataUrl = '';
    const newMandal: DemoMandal = {
      additionalMembers: String(form.get('additionalMembers') || '').trim(),
      address: String(form.get('address') || '').trim(),
      adhyakshName: String(form.get('adhyakshName') || '').trim(),
      adminEmail: String(form.get('adminEmail') || `admin@${slugify(mandalName || 'mandal')}.local`).trim(),
      adminPassword,
      city: String(form.get('city') || '').trim(),
      contactEmail: String(form.get('contactEmail') || '').trim(),
      contactPhone,
      khajindarName: String(form.get('khajindarName') || '').trim(),
      logoUrl: '',
      locality: String(form.get('locality') || '').trim(),
      memberCount: String(form.get('memberCount') || '').trim(),
      name: mandalName,
      slipLimit: Number(form.get('slipLimit') || 0) || null,
      whatsappMode: String(form.get('whatsappMode') || 'AUTO_API') as 'AUTO_API' | 'MANUAL_SHARE',
    };

    if (!newMandal.name) {
      setNotice('Mandal name is required.');
      setFormFieldError(formElement, 'name', 'Mandal name is required.');
      return { ok: false };
    }

    if (adminPassword.length < 12) {
      const message = 'Adhyaksh password must contain at least 12 characters.';
      setNotice(message);
      setFormFieldError(formElement, 'adminPassword', message);
      return { ok: false };
    }

    if (String(form.get('contactPhone') || '').trim() && !contactPhone) {
      setNotice('Enter phone as +919876543210 or a valid 10 digit Indian number.');
      setFormFieldError(formElement, 'contactPhone', 'Enter phone as +919876543210 or a valid 10 digit Indian number.');
      return { ok: false };
    }

    if (session?.user.role === 'SUPER_ADMIN') {
      startBusy('Creating mandal...');
      setNotice('Creating mandal...');
      try {
        if (logo instanceof File && logo.size > 0) {
          logoDataUrl = await imageFileToCompressedDataUrl(logo);
        }

        const created = await apiRequest<{ admin: MandalLoginUser; mandal: DemoMandal }>(
          '/mandals',
          {
            body: JSON.stringify({
              address: newMandal.address || undefined,
              admin: {
                email: newMandal.adminEmail,
                name: newMandal.adhyakshName || `${newMandal.name} Admin`,
                password: newMandal.adminPassword,
                phone: contactPhone || undefined,
              },
              city: newMandal.city || undefined,
              contactName: newMandal.adhyakshName || undefined,
              contactPhone: contactPhone || undefined,
              defaultTemplateUrl: absoluteAppUrl(TEMPLATE_IMAGE),
              logoDataUrl: logoDataUrl || undefined,
              locality: newMandal.locality || undefined,
              name: newMandal.name,
              plan: 'starter',
              partnerId: String(form.get('partnerId') || '') || undefined,
              slipLimit: newMandal.slipLimit || undefined,
              state: 'Maharashtra',
              whatsappMode: newMandal.whatsappMode,
            }),
            method: 'POST',
          },
          session,
        );
        formElement.reset();
        const createdMandal = mapBackendMandal({ ...created.mandal, users: [created.admin] });
        setDemoMandals((current) => [createdMandal, ...current]);
        if (createdMandal.partnerId) {
          setPartners((current) => current.map((partner) => partner.id === createdMandal.partnerId
            ? {
                ...partner,
                _count: { ...partner._count, mandals: Number(partner._count?.mandals ?? partner.mandals?.length ?? 0) + 1 },
                mandals: [
                  {
                    city: createdMandal.city,
                    contactPhone: createdMandal.contactPhone,
                    id: createdMandal.id as string,
                    locality: createdMandal.locality,
                    name: createdMandal.name,
                    plan: createdMandal.plan,
                    slug: createdMandal.slug,
                    status: createdMandal.status,
                  },
                  ...(partner.mandals ?? []),
                ],
              }
            : partner));
        }
        setNotice(`${newMandal.name} added. Admin password: ${newMandal.adminPassword}`);
        return { id: created.mandal.id, ok: true };
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not add mandal.');
        focusFormErrorFromMessage(formElement, error);
        return { ok: false };
      } finally {
        stopBusy();
      }
    }

    setNotice('Only Super Admin can add mandals.');
    return { ok: false };
  }

  async function addTemplateCustomField(label: string, required = true) {
    const trimmedLabel = label.trim();
    if (!session || !session.user.mandalId || !activeForm || !trimmedLabel) return;
    const field = await apiRequest<CustomField>(
      `/mandals/${session.user.mandalId}/festivals/${activeForm.festival.id}/custom-fields`,
      {
        body: JSON.stringify({
          label: trimmedLabel,
          printOnSlip: true,
          required,
          sortOrder: (activeForm.customFields?.length ?? 0) + 1,
          type: 'TEXT',
        }),
        method: 'POST',
      },
      session,
    );
    setActiveForm((current) => current
      ? { ...current, customFields: [...(current.customFields ?? []), field] }
      : current);
    setNotice(`${required ? 'Compulsory' : 'Optional'} template field added.`);
    return field;
  }

  async function updateMandalDetails(mandalId: string, patch: Record<string, unknown>) {
    if (!session || session.user.role !== 'SUPER_ADMIN') return null;
    try {
      const updated = await apiRequest<DemoMandal>(
        `/mandals/${mandalId}`,
        { body: JSON.stringify(patch), method: 'PATCH' },
        session,
      );
      setDemoMandals((current) => current.map((mandal) =>
        mandal.id === mandalId ? mapBackendMandal({ ...mandal, ...updated }) : mandal));
      setNotice('Mandal details updated successfully.');
      scheduleWorkspaceSync(session);
      return updated;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update Mandal details.');
      return null;
    }
  }

  async function createPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || session.user.role !== 'SUPER_ADMIN') return false;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const rawPhone = String(form.get('phone') || '').trim();
    const phone = normalizeOptionalIndianPhone(rawPhone);
    if (rawPhone && !phone) {
      setNotice('Enter partner mobile as +919876543210 or a valid 10 digit Indian number.');
      setFormFieldError(formElement, 'phone', 'Enter partner mobile as +919876543210 or a valid 10 digit Indian number.');
      return false;
    }
    try {
      const partner = await apiRequest<Partner>(
        '/partners',
        {
          body: JSON.stringify({
            address: String(form.get('address') || '').trim() || undefined,
            email: String(form.get('email') || '').trim().toLowerCase() || undefined,
            name: String(form.get('name') || '').trim(),
            phone: phone || undefined,
          }),
          method: 'POST',
        },
        session,
      );
      setPartners((current) => [partner, ...current]);
      formElement.reset();
      setNotice(`${partner.name} added as partner.`);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not add partner.');
      focusFormErrorFromMessage(formElement, error);
      return false;
    }
  }

  async function updatePartner(partnerId: string, patch: Record<string, unknown>) {
    if (!session || session.user.role !== 'SUPER_ADMIN') return null;
    try {
      const partner = await apiRequest<Partner>(
        `/partners/${partnerId}`,
        { body: JSON.stringify(patch), method: 'PATCH' },
        session,
      );
      setPartners((current) => current.map((item) => (item.id === partnerId ? partner : item)));
      setDemoMandals((current) => current.map((mandal) =>
        mandal.partnerId === partnerId ? { ...mandal, partner } : mandal));
      setNotice(`${partner.name} updated.`);
      scheduleWorkspaceSync(session);
      return partner;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update partner.');
      return null;
    }
  }

  async function archivePartner(partner: Partner) {
    if (!session || session.user.role !== 'SUPER_ADMIN') return false;
    const confirmed = await askConfirm({
      confirmLabel: 'Archive Partner',
      danger: true,
      message: `${partner.name} will be hidden from active partner lists. Assigned mandals will keep their attribution until changed.`,
      title: 'Archive partner?',
    });
    if (!confirmed) return false;

    try {
      await apiRequest(`/partners/${partner.id}`, { method: 'DELETE' }, session);
      setPartners((current) => current.filter((item) => item.id !== partner.id));
      setNotice(`${partner.name} archived.`);
      scheduleWorkspaceSync(session);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not archive partner.');
      return false;
    }
  }

  async function updateMandalLogin(mandalId: string, userId: string, patch: Record<string, unknown>) {
    if (!session || session.user.role !== 'SUPER_ADMIN') return null;
    try {
      const updated = await apiRequest<MandalLoginUser>(
        `/mandals/${mandalId}/users/${userId}`,
        { body: JSON.stringify(patch), method: 'PATCH' },
        session,
      );
      setDemoMandals((current) => current.map((mandal) =>
        mandal.id === mandalId
          ? {
              ...mandal,
              adminEmail: updated.role === 'MANDAL_ADMIN' ? updated.email ?? mandal.adminEmail : mandal.adminEmail,
              users: (mandal.users ?? []).map((user) => user.id === userId ? updated : user),
            }
          : mandal));
      setNotice('Login details updated successfully.');
      scheduleWorkspaceSync(session);
      return updated;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update login.');
      return null;
    }
  }

  function addMandalLoginToWorkspace(mandalId: string, user: MandalLoginUser) {
    setDemoMandals((current) => current.map((mandal) =>
      mandal.id === mandalId
        ? { ...mandal, users: upsertById(mandal.users ?? [], user) }
        : mandal));
  }

  async function archiveMandal(mandal: DemoMandal) {
    if (!session || session.user.role !== 'SUPER_ADMIN' || !mandal.id) return false;

    const confirmed = await askConfirm({
      confirmLabel: 'Delete Mandal',
      danger: true,
      message: `${mandal.name} and its users, members, groups, slips, expenses, tasks, templates, and logins will be permanently deleted from the database.`,
      title: 'Permanently delete mandal?',
    });
    if (!confirmed) return false;

    startBusy('Deleting mandal...');
    try {
      await apiRequest(`/mandals/${mandal.id}`, { method: 'DELETE' }, session);
      setDemoMandals((current) => current.filter((item) => item.id !== mandal.id));
      setNotice(`${mandal.name} permanently deleted.`);
      scheduleWorkspaceSync(session);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete mandal.');
      return false;
    } finally {
      stopBusy();
    }
  }

  async function generateSlip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return false;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const idempotencyKey = formElement.dataset.idempotencyKey || crypto.randomUUID();
    formElement.dataset.idempotencyKey = idempotencyKey;
    const paymentStatus = String(form.get('paymentStatus') || 'ACTIVE') === 'PENDING' ? 'PENDING' : 'ACTIVE';
    const contributorPhoneInput = String(form.get('contributorPhone') || '');
    const contributorPhone = nationalIndianMobileNumber(contributorPhoneInput);
    if (contributorPhoneInput && !/^[6-9][0-9]{9}$/.test(contributorPhone)) {
      const message = 'Enter a valid 10-digit Indian WhatsApp number.';
      setNotice(message);
      setFormFieldError(formElement, 'contributorPhone', message);
      return false;
    }
    prepareWhatsAppWindow(paymentStatus);
    const customData: Record<string, unknown> = Object.fromEntries(
      (activeForm?.customFields ?? []).map((field) => [
        field.key,
        field.type === 'CHECKBOX'
          ? form.get(`custom_${field.key}`) === 'yes'
          : String(form.get(`custom_${field.key}`) || ''),
      ]),
    );
    const contributorNameMr = String(form.get('contributorNameMr') || '').trim();
    if (contributorNameMr) {
      customData.contributorNameMr = contributorNameMr;
    }
    const contributorAddressMr = String(form.get('contributorAddressMr') || '').trim();
    if (contributorAddressMr) {
      customData.contributorAddressMr = contributorAddressMr;
    }
    const tentativePaymentDate = String(form.get('tentativePaymentDate') || '');
    if (tentativePaymentDate) {
      customData.tentativePaymentDate = tentativePaymentDate;
    }
    try {
      const slip = await apiRequest<Slip>(
        '/vargani/slips',
        {
          body: JSON.stringify({
            amount: Number(form.get('amount')),
            areaName: String(form.get('areaName') || '').trim() || undefined,
            contributorAddress: String(form.get('contributorAddress') || ''),
            contributorName: String(form.get('contributorName') || ''),
            contributorPhone,
            customData,
            groupId: String(form.get('groupId') || '') || undefined,
            idempotencyKey,
            paymentMode: String(form.get('paymentMode') || 'CASH') as PaymentMode,
            shopName: String(form.get('shopName') || ''),
            status: paymentStatus,
          }),
          method: 'POST',
        },
        session,
      );
      setSlips((current) => [slip, ...current]);
      setSelectedSlip(slip);
      formElement.reset();
      delete formElement.dataset.idempotencyKey;
      if (paymentStatus === 'PENDING') {
        setNotice(`Pending vargani entry ${slip.slipNumber} saved.`);
        scheduleWorkspaceSync(session, 1200);
      } else {
        setNotice(`Slip ${slip.slipNumber} generated. Preparing the receipt in the background...`);
        void (async () => {
          try {
            const upload = await uploadRenderedSlipImage(slip);
            if (currentMandal?.whatsappMode === 'MANUAL_SHARE') {
              setNotice(`Slip ${slip.slipNumber} generated. Tap the WhatsApp button to share it manually.`);
            } else {
              const share = upload.share ?? await createReceiptShare(slip, contributorPhone);
              setNotice(whatsappStatusMessage(slip, share?.whatsapp, 'generated'));
            }
          } catch (shareError) {
            const detail = shareError instanceof ApiError && shareError.status >= 500
              ? 'server could not finish receipt sharing'
              : shareError instanceof Error
                ? shareError.message
                : 'receipt sharing failed';
            setNotice(`Slip ${slip.slipNumber} generated. Receipt sharing needs manual retry: ${detail}.`);
          } finally {
            scheduleWorkspaceSync(session, 1200);
          }
        })();
      }
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not generate slip.');
      focusFormErrorFromMessage(formElement, error);
      return false;
    }
  }

  async function renderSlipJpegBlob(slip: Slip) {
      let placements: Record<string, TemplatePlacement> =
        normalizeTemplatePlacements(latestTemplateVersion?.renderConfig?.fields);
      let bgUrl = resolveTemplateAssetUrl(latestTemplateVersion?.backgroundFileUrl || templatePreview || TEMPLATE_IMAGE);

      if (Object.keys(placements).length === 0) {
        placements = {
          amount: { ...defaultPlacement(), color: '#111111', fontSize: 31, fontWeight: 900, height: 52, textAlign: 'left', width: 250, x: 720, y: 680 },
          building_name: { ...defaultPlacement(), color: '#111111', fontSize: 24, fontWeight: 700, height: 48, textAlign: 'left', width: 420, x: 715, y: 623 },
          contributorAddress: { ...defaultPlacement(), color: '#111111', fontSize: 27, fontWeight: 800, height: 70, textAlign: 'left', textWrap: 'wrap', width: 560, x: 715, y: 574 },
          contributorName: { ...defaultPlacement(), color: '#111111', fontSize: 30, fontWeight: 900, height: 58, textAlign: 'left', width: 610, x: 670, y: 515 },
          createdAt: { ...defaultPlacement(), color: '#111111', fontSize: 25, fontWeight: 800, height: 46, textAlign: 'center', width: 160, x: 1115, y: 455 },
          slipNumber: { ...defaultPlacement(), color: '#b62028', fontSize: 31, fontWeight: 900, height: 48, textAlign: 'left', width: 100, x: 648, y: 445 },
        };
      }

      const canvasWidth = latestTemplateVersion?.canvasWidth ?? 1328;
      const canvasHeight = latestTemplateVersion?.canvasHeight ?? 800;
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas rendering context unavailable');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const img = await loadSlipBackground(bgUrl);

      drawContainedImage(ctx, img, canvasWidth, canvasHeight);

      const d = new Date(slip.createdAt);
      const formattedDate = !isNaN(d.getTime())
        ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
        : slip.createdAt ? slip.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);

      const rawAmount = Number(slip.amount);
      const formattedAmount = !isNaN(rawAmount) ? rawAmount.toLocaleString('en-IN') : String(slip.amount || '0');

      const values: Record<string, string> = {
        amount: formattedAmount,
        amountWords: amountToIndianWords(rawAmount),
        amountWordsMarathi: amountToMarathiWords(rawAmount),
        building_name: slip.customData?.building_name || sampleFieldValue('building_name', 'Building / Lane'),
        contributorAddress: String(slip.customData?.contributorAddressMr || '').trim() || slip.contributorAddress || sampleFieldValue('contributorAddress', 'Address'),
        contributorAddressMr: String(slip.customData?.contributorAddressMr || '').trim() || transliterateReceiptTextToMarathi(slip.contributorAddress || ''),
        contributorName: String(slip.customData?.contributorNameMr || '').trim() || slip.contributorName || sampleFieldValue('contributorName', 'Name'),
        contributorNameMr: String(slip.customData?.contributorNameMr || '').trim() || transliterateReceiptTextToMarathi(slip.contributorName || ''),
        contributorPhone: slip.contributorPhone || sampleFieldValue('contributorPhone', 'Mobile No.'),
        createdAt: formattedDate,
        paymentMode: slip.paymentMode || 'CASH',
        shopName: slip.shopName || '',
        slipNumber: printableSlipSequence(slip.slipNumber || '001'),
        areaName: slip.areaName || '',
        collectorName: session?.user.name || 'Collector',
      };

      Object.entries(placements).forEach(([key, p]) => {
        const baseKey = baseTemplateFieldKey(key);
        let text = values[baseKey] ?? slip.customData?.[baseKey] ?? sampleFieldValue(baseKey, baseKey);
        if (!text) return;

        const renderText = transformTemplateText(receiptRenderText(baseKey, text, rawAmount), p);
        ctx.save();
        ctx.globalAlpha = p.opacity ?? 1;
        const fontStyle = p.fontStyle === 'italic' ? 'italic ' : '';
        const fontWeight = p.fontWeight || 700;
        let fontSize = p.fontSize || 24;
        const fontFamily = p.fontFamily || '"Noto Sans Devanagari", Arial, sans-serif';

        if (p.textWrap === 'shrink' && renderText.length > 18) {
          fontSize = Math.max(10, fontSize - Math.ceil((renderText.length - 18) / 3));
        }

        ctx.font = `${fontStyle}${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = p.color || '#111111';
        ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
        ctx.rotate(((p.rotate || 0) * Math.PI) / 180);
        const localX = -p.width / 2;
        const localY = -p.height / 2;

        if (shouldPrintFieldBackground(p.backgroundColor)) {
          ctx.fillStyle = p.backgroundColor;
          ctx.fillRect(localX, localY, p.width, p.height);
          ctx.fillStyle = p.color || '#111111';
        }

        if (shouldPrintFieldBorder(p.borderColor)) {
          ctx.strokeStyle = p.borderColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(localX, localY, p.width, p.height);
        }

        ctx.beginPath();
        ctx.rect(localX, localY, p.width, p.height);
        ctx.clip();

        ctx.textAlign = p.textAlign || 'left';
        let textX = localX + (p.padding || 0);
        if (p.textAlign === 'center') {
          textX = 0;
        } else if (p.textAlign === 'right') {
          textX = localX + p.width - (p.padding || 0);
        }

        const isSingleLine = (p.textWrap ?? 'single') !== 'wrap';
        let textY: number;

        if (isSingleLine) {
          ctx.textBaseline = 'middle';
          textY = 0;
        } else {
          ctx.textBaseline = 'top';
          textY = localY + (p.padding || 4);
        }

        if (p.shadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.4)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        }

        if (isSingleLine) {
          drawCanvasText(ctx, renderText, textX, textY, p.letterSpacing || 0);
        } else {
          drawWrappedCanvasText(ctx, renderText, textX, textY, p.width, p.height, fontSize, p.lineHeight || 1.15, p.letterSpacing || 0);
        }
        ctx.restore();
      });

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Could not generate JPEG slip image.'));
            return;
          }
          resolve(blob);
        }, 'image/jpeg', 0.95);
      });
  }

  async function downloadSlipAsJpeg(slip: Slip) {
    startBusy('Preparing slip image...');
    try {
      const blob = await renderSlipJpegBlob(slip);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Slip_${slip.slipNumber || slip.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice(`Slip ${slip.slipNumber} downloaded as JPEG image.`);
      stopBusy();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not download slip image');
      stopBusy();
    }
  }

  async function shareSlip(slip: Slip) {
    if (!isSlipPaid(slip)) {
      setNotice('Receipt can be shared only after payment is received.');
      return;
    }
    const manualShare = currentMandal?.whatsappMode === 'MANUAL_SHARE';
    if (manualShare) {
      whatsappWindowRef.current = window.open('about:blank', '_blank');
      if (whatsappWindowRef.current) whatsappWindowRef.current.opener = null;
    }
    startBusy(manualShare ? 'Preparing WhatsApp...' : 'Sending WhatsApp receipt...');
    try {
      if (!slip.receiptImageUrl) await uploadRenderedSlipImage(slip);
      const share = await createReceiptShare(slip, slip.contributorPhone, manualShare);
      if (manualShare && share?.receiptUrl) {
        const phone = normalizeIndianPhone(slip.contributorPhone);
        const message = encodeURIComponent(`Namaskar ${slip.contributorName}, your Vargani receipt ${slip.slipNumber}: ${share.receiptUrl}`);
        const whatsappUrl = `https://wa.me/${phone}?text=${message}`;
        if (whatsappWindowRef.current) {
          whatsappWindowRef.current.location.href = whatsappUrl;
        } else {
          window.location.href = whatsappUrl;
        }
        whatsappWindowRef.current = null;
        setNotice(`WhatsApp opened for slip ${slip.slipNumber}. Send it manually.`);
      } else {
        setNotice(whatsappStatusMessage(slip, share?.whatsapp, 'shared'));
      }
    } catch (error) {
      whatsappWindowRef.current?.close();
      whatsappWindowRef.current = null;
      setNotice(error instanceof Error ? error.message : 'Could not share receipt.');
    } finally {
      stopBusy();
    }
  }

  async function createExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !mandalId || !festivalId) return false;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const description = String(form.get('description') || '').trim();
    const category = String(form.get('category') || '').trim();
    const proofPhoto = form.get('proofPhoto');
    if (proofPhoto instanceof File && proofPhoto.size > 6 * 1024 * 1024) {
      setFormFieldError(formElement, 'proofPhoto', 'Proof photo must be 6 MB or smaller.');
      return false;
    }
    if (proofPhoto instanceof File && proofPhoto.size > 0 && !['image/jpeg', 'image/png', 'image/webp'].includes(proofPhoto.type)) {
      setFormFieldError(formElement, 'proofPhoto', 'Use a JPG, PNG, or WebP proof photo.');
      return false;
    }

    const expensePayload = new FormData();
    const amount = Number(form.get('amount') || 0);
    const expenseDate = String(form.get('date') || new Date().toISOString().slice(0, 10));
    expensePayload.set('amount', String(amount));
    expensePayload.set('expenseDate', expenseDate);
    expensePayload.set('status', 'APPROVED');
    const notes = category ? `${description}\nCategory: ${category}` : description;
    if (description || category) expensePayload.set('notes', notes);
    const vendorName = String(form.get('vendor') || '').trim();
    if (vendorName) expensePayload.set('vendorName', vendorName);
    if (proofPhoto instanceof File && proofPhoto.size > 0) expensePayload.set('proofPhoto', proofPhoto);

    const optimisticId = `pending-expense-${crypto.randomUUID()}`;
    const optimisticExpense: Expense = {
      amount,
      billFileUrl: null,
      createdAt: new Date().toISOString(),
      creator: { id: session.user.id, name: session.user.name },
      expenseDate,
      id: optimisticId,
      notes: notes || null,
      status: 'APPROVED',
      vendorName: vendorName || null,
    };
    setExpenses((current) => upsertById(current, optimisticExpense));
    setWorkspaceMetrics((current) => ({
      ...current,
      balance: Number(current.balance ?? 0) - amount,
      totalExpenses: Number(current.totalExpenses ?? 0) + amount,
    }));
    formElement.reset();
    setNotice(proofPhoto instanceof File && proofPhoto.size > 0 ? 'Expense added. Uploading proof photo…' : 'Expense added. Saving…');

    void apiRequest<Expense>(
      `/mandals/${mandalId}/festivals/${festivalId}/expenses`,
      { body: expensePayload, method: 'POST' },
      session,
    ).then((expense) => {
      setExpenses((current) => upsertById(current.filter((item) => item.id !== optimisticId), expense));
      setNotice(proofPhoto instanceof File && proofPhoto.size > 0 ? 'Expense and proof photo saved.' : 'Expense saved.');
      scheduleWorkspaceSync(session);
    }).catch((error: unknown) => {
      setExpenses((current) => current.filter((item) => item.id !== optimisticId));
      setWorkspaceMetrics((current) => ({
        ...current,
        balance: Number(current.balance ?? 0) + amount,
        totalExpenses: Math.max(0, Number(current.totalExpenses ?? 0) - amount),
      }));
      setNotice(error instanceof Error ? `Expense was not saved: ${error.message}` : 'Expense was not saved. Try again.');
    });
    return true;
  }

  async function updateExpense(expense: Expense) {
    if (!session || !mandalId || !festivalId) return;
    const amount = await askPrompt({
      defaultValue: String(expense.amount),
      placeholder: 'Enter expense amount',
      title: 'Expense amount',
    });
    if (amount === null) return;
    const vendorName = await askPrompt({
      defaultValue: expense.vendorName ?? '',
      placeholder: 'Enter vendor name',
      title: 'Vendor name',
    }) ?? expense.vendorName ?? '';
    try {
      const updatedExpense = await apiRequest<Expense>(
        `/mandals/${mandalId}/festivals/${festivalId}/expenses/${expense.id}`,
        {
          body: JSON.stringify({
            amount: Number(amount),
            expenseDate: expense.expenseDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            notes: expense.notes,
            status: expense.status,
            vendorName,
          }),
          method: 'PATCH',
        },
        session,
      );
      setExpenses((current) => upsertById(current, updatedExpense));
      setNotice('Expense updated.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update expense.');
    }
  }

  async function deleteExpense(expense: Expense) {
    if (!session || !mandalId || !festivalId) return;
    const confirmed = await askConfirm({
      confirmLabel: 'Delete Expense',
      danger: true,
      message: `${expense.vendorName || expense.notes || 'This expense'} will be permanently deleted.`,
      title: 'Delete expense?',
    });
    if (!confirmed) return;
    try {
      await apiRequest(
        `/mandals/${mandalId}/festivals/${festivalId}/expenses/${expense.id}`,
        { method: 'DELETE' },
        session,
      );
      setExpenses((current) => current.filter((item) => item.id !== expense.id));
      setNotice('Expense deleted.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete expense.');
    }
  }

  function taskPayloadFromForm(form: FormData): Partial<FestivalTask> {
    return {
      assigneeUserId: String(form.get('assigneeUserId') || '') || undefined,
      dueDate: String(form.get('dueDate') || '') || undefined,
      groupId: String(form.get('groupId') || '') || undefined,
      notes: String(form.get('notes') || '').trim() || undefined,
      priority: String(form.get('priority') || 'MEDIUM') as TaskPriority,
      status: String(form.get('status') || 'OPEN') as TaskStatus,
      title: String(form.get('title') || '').trim(),
    };
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !mandalId || !festivalId) return false;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get('name') || '').trim();
    if (!name) {
      setFormFieldError(formElement, 'name', 'Group name is required.');
      return false;
    }
    try {
      const group = await apiRequest<Group>(
        `/mandals/${mandalId}/festivals/${festivalId}/groups`,
        {
          body: JSON.stringify({
            areaName: String(form.get('areaName') || '').trim() || undefined,
            leaderUserId: String(form.get('leaderUserId') || '') || undefined,
            name,
          }),
          method: 'POST',
        },
        session,
      );
      setGroups((current) => upsertById(current, group));
      formElement.reset();
      setNotice('Group created.');
      scheduleWorkspaceSync(session);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create group.');
      focusFormErrorFromMessage(formElement, error);
      return false;
    }
  }

  async function updateGroup(groupId: string, patch: { areaName?: string | null; leaderUserId?: string | null; name?: string }) {
    if (!session || !mandalId || !festivalId) return;
    try {
      const group = await apiRequest<Group>(
        `/mandals/${mandalId}/festivals/${festivalId}/groups/${groupId}`,
        {
          body: JSON.stringify(patch),
          method: 'PATCH',
        },
        session,
      );
      setGroups((current) => upsertById(current, group));
      setNotice('Group updated.');
      scheduleWorkspaceSync(session);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update group.');
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !mandalId || !festivalId) return false;
    const formElement = event.currentTarget;
    const payload = taskPayloadFromForm(new FormData(formElement));
    if (!payload.title) {
      setFormFieldError(formElement, 'title', 'Task title is required.');
      return false;
    }
    try {
      const task = await apiRequest<FestivalTask>(
        `/mandals/${mandalId}/festivals/${festivalId}/tasks`,
        {
          body: JSON.stringify(payload),
          method: 'POST',
        },
        session,
      );
      setTasks((current) => upsertById(current, task));
      formElement.reset();
      setNotice('Task added.');
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not add task.');
      focusFormErrorFromMessage(formElement, error);
      return false;
    }
  }

  async function updateTask(task: FestivalTask, patch?: Partial<FestivalTask> | FormEvent<HTMLFormElement>) {
    if (!session || !mandalId || !festivalId) return;
    const isFormEvent = patch && 'currentTarget' in patch;
    if (isFormEvent) patch.preventDefault();
    const nextPatch: Partial<FestivalTask> = isFormEvent
      ? taskPayloadFromForm(new FormData(patch.currentTarget))
      : patch ?? {};
    const title = nextPatch?.title ?? task.title;
    if (!title?.trim()) return;
    try {
      const updatedTask = await apiRequest<FestivalTask>(
        `/mandals/${mandalId}/festivals/${festivalId}/tasks/${task.id}`,
        {
          body: JSON.stringify({
            assigneeUserId: nextPatch?.assigneeUserId ?? task.assigneeUserId ?? undefined,
            dueDate: nextPatch?.dueDate ?? task.dueDate ?? undefined,
            groupId: nextPatch?.groupId ?? task.groupId ?? undefined,
            notes: nextPatch?.notes ?? task.notes ?? undefined,
            priority: nextPatch?.priority ?? task.priority,
            status: nextPatch?.status ?? task.status,
            title,
          }),
          method: 'PATCH',
        },
        session,
      );
      setTasks((current) => upsertById(current, updatedTask));
      setNotice('Task updated.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update task.');
    }
  }

  async function deleteTask(task: FestivalTask) {
    if (!session || !mandalId || !festivalId) return;
    const confirmed = await askConfirm({
      confirmLabel: 'Delete Task',
      danger: true,
      message: task.title,
      title: 'Delete task?',
    });
    if (!confirmed) return;
    try {
      await apiRequest(
        `/mandals/${mandalId}/festivals/${festivalId}/tasks/${task.id}`,
        { method: 'DELETE' },
        session,
      );
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setNotice('Task deleted.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete task.');
    }
  }

  async function updateMember(member: Member) {
    if (!session || !mandalId || !festivalId) return;
    const name = await askPrompt({
      defaultValue: member.displayName,
      placeholder: 'Enter member name',
      title: 'Member name',
    });
    if (!name?.trim()) return;
    const phone = await askPrompt({
      defaultValue: member.phone ?? member.user?.phone ?? '',
      placeholder: 'Enter phone number',
      title: 'Phone number',
    }) ?? member.phone ?? member.user?.phone ?? '';
    const areaName = await askPrompt({
      defaultValue: member.areaName ?? '',
      placeholder: 'Enter area',
      title: 'Area',
    }) ?? member.areaName ?? '';
    try {
      const updatedMember = await apiRequest<Member>(
        `/mandals/${mandalId}/festivals/${festivalId}/members/${member.id}`,
        {
          body: JSON.stringify({ areaName, name: name.trim(), phone, role: member.user?.role ?? 'MEMBER' }),
          method: 'PATCH',
        },
        session,
      );
      setMembers((current) => upsertById(current, updatedMember));
      setNotice('Member updated.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update member.');
    }
  }

  async function assignMemberGroup(member: Member, groupId: string) {
    if (!session || !mandalId || !festivalId) return;
    const userId = getMemberUserId(member);
    const isOrphanLeader = member.user?.role === 'GROUP_LEADER' && !groups.some((group) => group.leader?.id === userId);
    try {
      const updatedMember = await apiRequest<Member>(
        `/mandals/${mandalId}/festivals/${festivalId}/members/${member.id}`,
        {
          body: JSON.stringify({
            areaName: member.areaName ?? '',
            groupId: groupId || null,
            name: member.displayName,
            phone: member.phone ?? member.user?.phone ?? '',
            role: isOrphanLeader ? 'MEMBER' : member.user?.role ?? 'MEMBER',
          }),
          method: 'PATCH',
        },
        session,
      );
      setMembers((current) => upsertById(current, updatedMember));
      setNotice(isOrphanLeader ? 'Member assigned to group and old orphan leader role cleaned.' : 'Member group updated.');
      scheduleWorkspaceSync(session);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update member group.');
    }
  }

  async function archiveMember(member: Member) {
    if (!session || !mandalId || !festivalId) return;
    const confirmed = await askConfirm({
      confirmLabel: 'Delete Member',
      danger: true,
      message: `${member.displayName}, their login, assigned tasks, and slips collected by this login will be permanently deleted from the database.`,
      title: 'Permanently delete member?',
    });
    if (!confirmed) return;
    try {
      await apiRequest(
        `/mandals/${mandalId}/festivals/${festivalId}/members/${member.id}`,
        { method: 'DELETE' },
        session,
      );
      setMembers((current) => current.filter((item) => item.id !== member.id));
      const userId = getMemberUserId(member);
      setGroups((current) => current.map((group) => {
        const hadMember = (group.members ?? []).some((item) => item.id === member.id);
        return {
          ...group,
          leader: group.leader?.id && group.leader.id === userId ? null : group.leader,
          members: (group.members ?? []).filter((item) => item.id !== member.id),
          _count: group._count && hadMember
            ? { ...group._count, members: Math.max(0, group._count.members - 1) }
            : group._count,
        };
      }));
      setNotice('Member permanently deleted.');
      scheduleWorkspaceSync(session);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete member.');
    }
  }

  function remindMember(member: Member) {
    const phone = normalizeIndianPhone(member.phone ?? member.user?.phone);
    if (!phone) {
      setNotice('Member phone number is missing.');
      return;
    }
    const message = encodeURIComponent(`Namaskar ${member.displayName}, please complete your Digital Vargani collection update for ${activeForm?.festival.name ?? 'the festival'}.`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    setNotice(`WhatsApp reminder opened for ${member.displayName}.`);
  }

  async function updateSlip(slip: Slip) {
    if (!session) return;
    const amount = await askPrompt({
      defaultValue: String(slip.amount),
      placeholder: 'Enter slip amount',
      title: 'Slip amount',
    });
    if (amount === null) return;
    const contributorName = await askPrompt({
      defaultValue: slip.contributorName,
      placeholder: 'Enter contributor name',
      title: 'Contributor name',
    }) ?? slip.contributorName;
    const contributorAddress = await askPrompt({
      defaultValue: slip.contributorAddress || '',
      multiline: true,
      placeholder: 'Enter contributor address',
      title: 'Contributor address',
    });
    if (contributorAddress === null) return;
    const contributorAddressMr = await askPrompt({
      defaultValue: String(slip.customData?.contributorAddressMr || '').trim()
        || transliterateReceiptTextToMarathi(contributorAddress),
      message: 'Review and correct the Marathi spelling exactly as it should appear on the slip.',
      multiline: true,
      placeholder: 'मराठी पत्ता',
      title: 'Address on Marathi slip',
    });
    if (contributorAddressMr === null) return;
    const statusInput = (await askPrompt({
      defaultValue: isSlipPaid(slip) ? 'ACTIVE' : 'PENDING',
      message: 'Use ACTIVE for paid slips or PENDING for unpaid slips.',
      placeholder: 'ACTIVE or PENDING',
      title: 'Slip status',
    }))?.toUpperCase();
    const status = statusInput === 'PENDING' ? 'PENDING' : 'ACTIVE';
    try {
      const updatedSlip = await apiRequest<Slip>(
        `/vargani/slips/${slip.id}`,
        {
          body: JSON.stringify({
            amount: Number(amount),
            areaName: slip.areaName,
            contributorAddress,
            contributorName,
            contributorPhone: slip.contributorPhone,
            customData: {
              ...slip.customData,
              contributorAddressMr: contributorAddressMr.trim(),
            },
            paymentMode: slip.paymentMode,
            shopName: slip.shopName,
            status,
          }),
          method: 'PATCH',
        },
        session,
      );
      setSlips((current) => upsertById(current, updatedSlip));
      setNotice('Slip updated.');
      scheduleWorkspaceSync(session);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update slip.');
    }
  }

  async function deleteSlip(slip: Slip) {
    if (!session) return;
    const confirmation = await askPrompt({
      confirmLabel: 'Delete Slip',
      danger: true,
      message: `${slip.slipNumber} for ${slip.contributorName} will be permanently deleted. This cannot be undone. Type DELETE to confirm.`,
      placeholder: 'Type DELETE',
      requiredValue: 'DELETE',
      title: 'Permanently delete slip?',
    });
    if (confirmation !== 'DELETE') {
      if (confirmation !== null) setNotice('Slip was not deleted. Type DELETE exactly to confirm.');
      return;
    }
    try {
      await apiRequest(`/vargani/slips/${slip.id}`, { method: 'DELETE' }, session);
      setSlips((current) => current.filter((item) => item.id !== slip.id));
      setSlipMeta((current) => ({
        ...current,
        total: Math.max(0, current.total - 1),
        totalPages: Math.max(1, Math.ceil(Math.max(0, current.total - 1) / current.limit)),
      }));
      setNotice(`${slip.slipNumber} permanently deleted.`);
      scheduleWorkspaceSync(session);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete slip.');
    }
  }

  const overlayMessage = busy ? busyMessage || 'Working...' : '';
  const withActionOverlay = (content: ReactNode) => (
    <>
      {content}
      {session && workspaceRefreshing && !workspaceLoaded && (
        <div aria-live="polite" className="workspace-starting-toast" role="status">
          <span aria-hidden="true" className="simple-spinner" />
          <span><strong>Opening workspace</strong><small>Loading your latest data…</small></span>
        </div>
      )}
      {overlayMessage && <ActionLoaderOverlay message={overlayMessage} />}
      {themedDialog && <ThemedDialogModal dialog={themedDialog} onClose={closeThemedDialog} />}
    </>
  );

  if (!authReady) {
    return <AuthLoadingScreen detail="Checking saved login..." />;
  }

  const isCollectorRole = session?.user.role === 'MEMBER' || session?.user.role === 'GROUP_LEADER';

  if (isCollectorRole) {
    return withActionOverlay(
      <MemberCollectorApp
        activeForm={activeForm}
        busy={busy}
        entryFields={entryFields}
        modalOpen={collectorModalOpen}
        notice={notice}
        onDownloadSlip={downloadSlipAsJpeg}
        onFilterSlips={filterSlips}
        onGenerate={generateSlip}
        onLoadMoreSlips={loadMoreSlips}
        onLogout={logout}
        onModalChange={setCollectorModalOpen}
        onPrepareWhatsApp={prepareWhatsAppWindow}
        onShareSlip={shareSlip}
        onTaskDone={(task) => updateTask(task, { status: 'DONE' })}
        mandal={currentMandal}
        session={session}
        setSelectedSlip={setSelectedSlip}
        slipMeta={slipMeta}
        slips={slips}
        tasks={tasks}
        workspaceMetrics={workspaceMetrics}
        loadingMoreSlips={loadingMoreSlips}
      />,
    );
  }

  if (!session) {
    return withActionOverlay(<LoginPanel onSubmit={login} busy={loginBusy} notice={notice} />);
  }

  if (session.user.role === 'SUPER_ADMIN') {
    return withActionOverlay(
      <SuperAdminApp
        busy={busy}
        demoMandals={demoMandals}
        language={language}
        notice={notice}
        onArchivePartner={archivePartner}
        onCreatePartner={createPartner}
        onCreateMandal={createMandal}
        onArchiveMandal={archiveMandal}
        onLanguageChange={setLanguage}
        onLogout={logout}
        onMandalLoginCreated={addMandalLoginToWorkspace}
        onPrompt={askPrompt}
        onTemplateSaved={saveTemplateConfig}
        onUpdateMandal={updateMandalDetails}
        onUpdateMandalLogin={updateMandalLogin}
        onUpdatePartner={updatePartner}
        partners={partners}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        session={session}
        onPreviewChange={handlePreviewChange}
      />,
    );
  }

  return withActionOverlay(
    <AdhyakshApp
      activeForm={activeForm}
      busy={busy}
      entryFields={entryFields}
      expenses={expenses}
      groups={groups}
      members={members}
      mandal={currentMandal}
      notice={notice}
      onArchiveMember={archiveMember}
      onAddTemplateField={addTemplateCustomField}
      onAssignMemberGroup={assignMemberGroup}
      onDeleteSlip={deleteSlip}
      onCreateMember={createMember}
      onCreateExpense={createExpense}
      onCreateGroup={createGroup}
      onCreateCustomField={createCustomField}
      onCreateTask={createTask}
      onDeleteCustomField={deleteCustomField}
      onDeleteExpense={deleteExpense}
      onDeleteTask={deleteTask}
      onDownloadSlip={downloadSlipAsJpeg}
      onEditExpense={updateExpense}
      onEditMember={updateMember}
      onEditSlip={updateSlip}
      onEditTask={(task, event) => updateTask(task, event)}
      onGenerate={generateSlip}
      onFilterSlips={filterSlips}
      onLoadMoreSlips={loadMoreSlips}
      onLogout={logout}
      onPrompt={askPrompt}
      optimisticYear={pendingFestivalYear}
      onRemindMember={remindMember}
      onRefresh={() => loadWorkspace()}
      onYearChange={changeFestivalYear}
      onShareSlip={shareSlip}
      onTemplateSaved={(placements) => saveTemplateConfig(placements)}
      onTaskDone={(task) => updateTask(task, { status: 'DONE' })}
      onUpdateCustomField={updateCustomField}
      onUpdateEntryField={updateEntryField}
      onUpdateGroup={updateGroup}
      query={query}
      session={session}
      setQuery={setQuery}
      setSelectedSlip={setSelectedSlip}
      setSidebarOpen={setSidebarOpen}
      sidebarOpen={sidebarOpen}
      slipMeta={slipMeta}
      slips={slips}
      tasks={tasks}
      workspaceRefreshing={workspaceRefreshing}
      yearChanging={yearChanging}
      activeTemplate={activeTemplate}
      latestTemplateVersion={latestTemplateVersion}
      onPreviewChange={handlePreviewChange}
      onPrepareWhatsApp={prepareWhatsAppWindow}
      templatePreview={templatePreview}
      workspaceLoaded={workspaceLoaded}
      workspaceMetrics={workspaceMetrics}
      loadingMoreSlips={loadingMoreSlips}
    />,
  );
}

const adhyakshNavItems: Array<{ id: AdhyakshScreen; icon: ReactNode; label: string }> = [
  { id: 'members', icon: <UsersRound size={20} />, label: 'Members & Vargani' },
  { id: 'tasks', icon: <ShieldCheck size={20} />, label: 'Tasks' },
  { id: 'expenses', icon: <WalletCards size={20} />, label: 'Expenses' },
  { id: 'template', icon: <FileText size={20} />, label: 'Vargani Template' },
  { id: 'slips', icon: <BadgeIndianRupee size={20} />, label: 'Vargani Slips' },
  { id: 'form', icon: <SlidersHorizontal size={20} />, label: 'Form Management' },
  { id: 'users', icon: <UserCog size={20} />, label: 'User Management' },
  { id: 'logs', icon: <ClipboardList size={20} />, label: 'System Logs' },
];

const adhyakshScreenIds = adhyakshNavItems.map((item) => item.id);

function cleanHash(hash = typeof window === 'undefined' ? '' : window.location.hash) {
  return hash.replace(/^#\/?/, '');
}

function parseAdhyakshRoute(hash = typeof window === 'undefined' ? '' : window.location.hash): AdhyakshScreen | null {
  const route = cleanHash(hash);
  const screen = route.startsWith('mandal/') ? route.slice('mandal/'.length) : route;
  return adhyakshScreenIds.includes(screen as AdhyakshScreen) ? (screen as AdhyakshScreen) : null;
}

function parseOwnerRoute(hash = typeof window === 'undefined' ? '' : window.location.hash) {
  const route = cleanHash(hash);
  if (route === 'owner/mandals/new') {
    return {
      isNew: true,
      mandalId: null,
      screen: 'mandals' as OwnerScreen,
      tab: 'overview' as OwnerMandalTab,
    };
  }

  const [, screen, mandalId, tab] = route.match(/^owner\/(dashboard|mandals|partners)(?:\/([^/]+))?(?:\/(overview|template))?$/) ?? [];
  if (!screen) return null;
  return {
    isNew: false,
    mandalId: mandalId ? decodeURIComponent(mandalId) : null,
    screen: screen as OwnerScreen,
    tab: (tab as OwnerMandalTab | undefined) ?? 'overview',
  };
}

function isMemberRoute(hash = typeof window === 'undefined' ? '' : window.location.hash) {
  return cleanHash(hash) === 'member/slips';
}

function routeForLogin(type: 'mandal' | 'owner') {
  return type === 'owner' ? '#/super-admin/login' : '#/login';
}

function routeForAdhyaksh(screen: AdhyakshScreen) {
  return `#/mandal/${screen}`;
}

function routeForOwner(screen: OwnerScreen, mandalId?: string | null, tab: OwnerMandalTab = 'overview') {
  if (screen === 'dashboard') return '#/owner/dashboard';
  if (screen === 'partners') return '#/owner/partners';
  if (mandalId) return `#/owner/mandals/${encodeURIComponent(mandalId)}/${tab}`;
  return '#/owner/mandals';
}

function routeForNewMandal() {
  return '#/owner/mandals/new';
}

function routeForMember() {
  return '#/member/slips';
}

function writeRoute(nextHash: string, mode: 'push' | 'replace' = 'push') {
  if (typeof window === 'undefined') return;
  if (window.location.hash === nextHash) return;
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  if (mode === 'replace') {
    window.history.replaceState(null, '', nextUrl);
    return;
  }
  window.history.pushState(null, '', nextUrl);
}

function AuthLoadingScreen({ detail = 'Opening your workspace...' }: { detail?: string }) {
  return (
    <main className="loading-screen">
      <LoadingCard detail={detail} />
    </main>
  );
}

function ActionLoaderOverlay({ message }: { message: string }) {
  return (
    <div aria-live="polite" className="action-loader-overlay" role="status">
      <LoadingCard detail={message} compact />
    </div>
  );
}

function LoadingCard({ compact = false, detail }: { compact?: boolean; detail: string }) {
  return (
    <section aria-busy="true" className={`loading-card ${compact ? 'compact' : ''}`}>
      <span aria-hidden="true" className="simple-spinner workspace-spinner" />
      <div className="loading-copy">
        <strong>{compact ? 'Please wait' : 'Loading workspace'}</strong>
        <span>{detail}</span>
      </div>
    </section>
  );
}

function AdhyakshApp({
  activeTemplate,
  activeForm,
  busy,
  entryFields,
  expenses,
  groups,
  latestTemplateVersion,
  mandal,
  members,
  notice,
  onArchiveMember,
  onAddTemplateField,
  onAssignMemberGroup,
  onDeleteSlip,
  onCreateMember,
  onCreateExpense,
  onCreateGroup,
  onCreateCustomField,
  onCreateTask,
  onDeleteCustomField,
  onDeleteExpense,
  onDeleteTask,
  onDownloadSlip,
  onEditExpense,
  onEditMember,
  onEditSlip,
  onEditTask,
  onGenerate,
  onFilterSlips,
  onLoadMoreSlips,
  onLogout,
  onPreviewChange,
  onPrepareWhatsApp,
  onPrompt,
  optimisticYear,
  onRemindMember,
  onRefresh,
  onYearChange,
  onShareSlip,
  onTemplateSaved,
  onTaskDone,
  onUpdateCustomField,
  onUpdateEntryField,
  onUpdateGroup,
  query,
  session,
  setQuery,
  setSelectedSlip,
  setSidebarOpen,
  sidebarOpen,
  slipMeta,
  slips,
  tasks,
  templatePreview,
  workspaceLoaded,
  workspaceMetrics,
  workspaceRefreshing,
  yearChanging,
  loadingMoreSlips,
}: {
  activeTemplate?: Template;
  activeForm: ActiveForm | null;
  busy: boolean;
  entryFields: EntryFieldConfig[];
  expenses: Expense[];
  groups: Group[];
  latestTemplateVersion?: Template['versions'][number];
  mandal: DemoMandal | null;
  members: Member[];
  notice: string;
  onArchiveMember: (member: Member) => Promise<void> | void;
  onAddTemplateField: (label: string, required?: boolean) => Promise<CustomField | void>;
  onAssignMemberGroup: (member: Member, groupId: string) => Promise<void> | void;
  onDeleteSlip: (slip: Slip) => Promise<void> | void;
  onCreateMember: (event: FormEvent<HTMLFormElement>) => Promise<boolean | void> | boolean | void;
  onCreateExpense: (event: FormEvent<HTMLFormElement>) => Promise<boolean | void> | boolean | void;
  onCreateGroup: (event: FormEvent<HTMLFormElement>) => Promise<boolean | void> | boolean | void;
  onCreateCustomField: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  onCreateTask: (event: FormEvent<HTMLFormElement>) => Promise<boolean | void> | boolean | void;
  onDeleteCustomField: (field: CustomField) => Promise<void> | void;
  onDeleteExpense: (expense: Expense) => Promise<void> | void;
  onDeleteTask: (task: FestivalTask) => Promise<void> | void;
  onDownloadSlip: (slip: Slip) => Promise<void>;
  onEditExpense: (expense: Expense) => Promise<void> | void;
  onEditMember: (member: Member) => Promise<void> | void;
  onEditSlip: (slip: Slip) => Promise<void> | void;
  onEditTask: (task: FestivalTask, event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  onGenerate: (event: FormEvent<HTMLFormElement>) => Promise<boolean | void> | boolean | void;
  onFilterSlips: (filters: SlipListFilters) => Promise<void> | void;
  onLoadMoreSlips: () => Promise<void> | void;
  onLogout: () => void;
  onPreviewChange: (url: string) => void;
  onPrepareWhatsApp: (paymentStatus: 'ACTIVE' | 'PENDING') => void;
  onPrompt: (options: ThemedPromptOptions) => Promise<string | null>;
  optimisticYear: number | null;
  onRemindMember: (member: Member) => void;
  onRefresh: () => void;
  onYearChange: (year: number) => Promise<void> | void;
  onShareSlip: (slip: Slip) => Promise<void>;
  onTemplateSaved: (placements: Record<string, TemplatePlacement>) => Promise<void> | void;
  onTaskDone: (task: FestivalTask) => Promise<void> | void;
  onUpdateCustomField: (field: CustomField, patch: Partial<CustomField>) => Promise<void> | void;
  onUpdateEntryField: (key: EntryFieldKey, patch: Partial<EntryFieldConfig>) => void;
  onUpdateGroup: (groupId: string, patch: { areaName?: string | null; leaderUserId?: string | null; name?: string }) => Promise<void> | void;
  query: string;
  session: AuthSession;
  setQuery: (value: string) => void;
  setSelectedSlip: (slip: Slip) => void;
  setSidebarOpen: (value: boolean | ((open: boolean) => boolean)) => void;
  sidebarOpen: boolean;
  slipMeta: SlipPageMeta;
  slips: Slip[];
  tasks: FestivalTask[];
  templatePreview: string;
  workspaceLoaded: boolean;
  workspaceMetrics: MandalMetrics;
  workspaceRefreshing: boolean;
  yearChanging: boolean;
  loadingMoreSlips: boolean;
}) {
  const [screen, setScreen] = useState<AdhyakshScreen>(() => parseAdhyakshRoute() ?? 'members');
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryStatus, setEntryStatus] = useState<'ACTIVE' | 'PENDING'>('ACTIVE');
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberSubmitAttempted, setMemberSubmitAttempted] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<FestivalTask | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseProofName, setExpenseProofName] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState<null | 'entry' | 'expense' | 'group' | 'member' | 'task'>(null);
  const [localNotice, setLocalNotice] = useState('');
  const [slipFilter, setSlipFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [slipCreatorFilter, setSlipCreatorFilter] = useState('');
  const [slipDateFilter, setSlipDateFilter] = useState('');
  const [entriesExporting, setEntriesExporting] = useState<null | 'excel' | 'pdf'>(null);
  const deferredQuery = useDeferredValue(query);
  const slipFilterStartedRef = useRef(false);
  const activeYear = optimisticYear ?? festivalYear(activeForm?.festival);
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(new Set([currentYear, currentYear + 1, activeYear].filter(Boolean) as number[])).sort();
  const mandalIdentity = getMandalIdentity(mandal, session);
  const slipRows = slips;

  useEffect(() => {
    if (screen !== 'slips') return;
    const hasFilters = Boolean(query.trim() || slipCreatorFilter || slipDateFilter || slipFilter !== 'all');
    if (!hasFilters && !slipFilterStartedRef.current) return;
    slipFilterStartedRef.current = true;
    const timer = window.setTimeout(() => {
      void onFilterSlips({
        createdByUserId: slipCreatorFilter || undefined,
        date: slipDateFilter || undefined,
        search: query.trim() || undefined,
        status: slipFilter === 'paid' ? 'ACTIVE' : slipFilter === 'pending' ? 'PENDING' : undefined,
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [onFilterSlips, query, screen, slipCreatorFilter, slipDateFilter, slipFilter]);

  const memberUserId = getMemberUserId;
  const {
    entriesByPhone,
    expensesTotal,
    groupsWithStats,
    memberPaidCount,
    memberPendingCount,
    memberRows,
    memberVargani,
    paidSlipRows,
    pendingMemberVargani,
    pendingSlipAmount,
    pendingSlipRows,
    slipCreators,
    totalSlipCollection,
  } = useMemo(() => {
    const paid: Slip[] = [];
    const pending: Slip[] = [];
    const creatorNames = new Map<string, string>();
    const collectedByUser = new Map<string, number>();
    const collectedByGroup = new Map<string, number>();
    const contributionByPhone = new Map<string, number>();
    const slipEntriesByPhone = new Map<string, number>();
    let paidTotal = 0;
    let pendingTotal = 0;

    for (const slip of slipRows) {
      const amount = Number(slip.amount || 0);
      const contributorPhone = slip.contributorPhone;
      const normalizedPhone = normalizeIndianPhone(contributorPhone);
      if (contributorPhone) {
        slipEntriesByPhone.set(contributorPhone, (slipEntriesByPhone.get(contributorPhone) ?? 0) + 1);
      }
      if (slip.collectedByUserId) {
        creatorNames.set(slip.collectedByUserId, slip.collector?.name || 'Unknown member');
      }

      if (!isSlipPaid(slip)) {
        pending.push(slip);
        pendingTotal += amount;
        continue;
      }

      paid.push(slip);
      paidTotal += amount;
      if (normalizedPhone) {
        contributionByPhone.set(normalizedPhone, (contributionByPhone.get(normalizedPhone) ?? 0) + amount);
      }
      if (slip.collectedByUserId) {
        collectedByUser.set(slip.collectedByUserId, (collectedByUser.get(slip.collectedByUserId) ?? 0) + amount);
      }
      if (slip.groupId) {
        collectedByGroup.set(slip.groupId, (collectedByGroup.get(slip.groupId) ?? 0) + amount);
      }
    }

    const leaderGroupIds = new Set(groups.map((group) => group.leader?.id).filter(Boolean));
    const rows = members.map((member) => {
      const phone = member.phone ?? member.user?.phone ?? '';
      const normalizedPhone = normalizeIndianPhone(phone);
      const vargani = normalizedPhone ? contributionByPhone.get(normalizedPhone) ?? 0 : 0;
      const userId = memberUserId(member);
      const isLeader = leaderGroupIds.has(userId);
      const isOrphanLeader = member.user?.role === 'GROUP_LEADER' && !isLeader;
      return {
        collected: Number(member.collectionTotal ?? collectedByUser.get(userId) ?? 0),
        contact: phone || '-',
        groupName: member.group?.name ?? (isOrphanLeader ? 'Needs group assignment' : 'No group'),
        isLeader,
        isOrphanLeader,
        member,
        name: member.displayName,
        paidSlipCount: Number(member.paidSlipCount ?? 0),
        paid: vargani > 0,
        rawGroupId: member.group?.id ?? member.groupId ?? '',
        role: member.user?.role.replaceAll('_', ' ') ?? 'Member',
        vargani,
      };
    });

    const rowsByGroup = new Map<string, typeof rows>();
    const rowByUserId = new Map(rows.map((row) => [memberUserId(row.member), row]));
    for (const row of rows) {
      const groupId = row.member.group?.id ?? row.member.groupId;
      if (!groupId) continue;
      const groupRows = rowsByGroup.get(groupId);
      if (groupRows) groupRows.push(row);
      else rowsByGroup.set(groupId, [row]);
    }

    const groupStats = groups.map((group) => {
      const groupRows = rowsByGroup.get(group.id) ?? [];
      const leaderRow = group.leader?.id ? rowByUserId.get(group.leader.id) : undefined;
      const memberRowsForGroup = leaderRow && !groupRows.some((row) => row.member.id === leaderRow.member.id)
        ? [leaderRow, ...groupRows]
        : groupRows;
      let collected = 0;
      let slipCount = 0;
      for (const row of memberRowsForGroup) {
        collected += row.collected;
        slipCount += row.paidSlipCount;
      }
      return {
        ...group,
        collected: collected || Number(group.collectionTotal ?? collectedByGroup.get(group.id) ?? 0),
        memberRows: memberRowsForGroup,
        memberCount: memberRowsForGroup.length || group._count?.members || group.members?.length || 0,
        slipCount: slipCount || Number(group.paidSlipCount ?? group._count?.slips ?? 0),
      };
    });

    let paidMemberTotal = 0;
    let pendingMemberTotal = 0;
    let paidMembers = 0;
    for (const row of rows) {
      if (row.paid) {
        paidMembers += 1;
        paidMemberTotal += row.vargani;
      } else {
        pendingMemberTotal += row.vargani;
      }
    }

    return {
      entriesByPhone: slipEntriesByPhone,
      expensesTotal: expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      groupsWithStats: groupStats,
      memberPaidCount: paidMembers,
      memberPendingCount: rows.length - paidMembers,
      memberRows: rows,
      memberVargani: paidMemberTotal,
      paidSlipRows: paid,
      pendingMemberVargani: pendingMemberTotal,
      pendingSlipAmount: pendingTotal,
      pendingSlipRows: pending,
      slipCreators: Array.from(creatorNames),
      totalSlipCollection: paidTotal,
    };
  }, [expenses, groups, members, slipRows]);
  const totalSlipCount = Number(workspaceMetrics.slipTotalCount ?? slipMeta.total ?? slipRows.length);
  const paidSlipCount = Number(workspaceMetrics.slipPaidCount ?? paidSlipRows.length);
  const pendingSlipCount = Number(workspaceMetrics.slipPendingCount ?? pendingSlipRows.length);
  const paidSlipAmount = Number(workspaceMetrics.slipPaidAmount ?? totalSlipCollection);
  const totalPendingSlipAmount = Number(workspaceMetrics.slipPendingAmount ?? pendingSlipAmount);
  const filteredSlipRows = useMemo(() => {
    const source = slipFilter === 'paid' ? paidSlipRows : slipFilter === 'pending' ? pendingSlipRows : slipRows;
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return source.filter((slip) => {
      if (slipCreatorFilter && slip.collectedByUserId !== slipCreatorFilter) return false;
      if (slipDateFilter && slip.createdAt.slice(0, 10) !== slipDateFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = `${slip.slipNumber} ${slip.contributorName} ${slip.shopName ?? ''} ${slip.areaName ?? ''} ${slip.collector?.name ?? ''} ${slip.createdAt.slice(0, 10)}`;
      return haystack.toLowerCase().includes(normalizedQuery);
    });
  }, [deferredQuery, paidSlipRows, pendingSlipRows, slipCreatorFilter, slipDateFilter, slipFilter, slipRows]);
  const balance = Number(workspaceMetrics.balance ?? (totalSlipCollection + memberVargani - expensesTotal));
  const isInitialSync = workspaceRefreshing && !workspaceLoaded;
  const displayNotice = localNotice || (notice && /error|failed|expired|could not|logged out|unauthorized/i.test(notice) ? notice : '');
  const metricValue = (value: string) => (workspaceLoaded ? value : '--');
  const metricNote = (note: string) => (workspaceLoaded ? note : 'Loading live data');
  const userRows = useMemo(() => [
    {
      email: 'current-login',
      entries: slipRows.length,
      joined: 'Active now',
      member: undefined as Member | undefined,
      name: session.user.name,
      role: session.user.role.replaceAll('_', ' '),
    },
    ...members.map((member) => ({
      email: member.user?.email ?? '-',
      entries: entriesByPhone.get(member.phone ?? member.user?.phone ?? '') ?? 0,
      joined: 'Live member',
      member,
      name: member.displayName,
      role: member.user?.role.replaceAll('_', ' ') ?? 'MEMBER',
    })),
  ], [entriesByPhone, members, session.user.name, session.user.role, slipRows.length]);

  function showToast(message: string) {
    setLocalNotice(message);
    window.setTimeout(() => setLocalNotice(''), 2800);
  }

  async function downloadAllVarganiEntries() {
    const mandalId = mandal?.id;
    const festivalId = activeForm?.festival.id;
    if (!mandalId || !festivalId) {
      showToast('Active mandal festival not found. Refresh and try again.');
      return;
    }

    setEntriesExporting('excel');
    try {
      const { blob, fileName } = await apiDownload(
        `/mandals/${mandalId}/festivals/${festivalId}/reports/collections.xlsx`,
        session,
      );
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName || `${slugify(mandal.name)}-vargani-entries.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      showToast('Excel sheet downloaded successfully.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not download Excel sheet.');
    } finally {
      setEntriesExporting(null);
    }
  }

  async function downloadAccountingPdf() {
    const mandalId = mandal?.id;
    const festivalId = activeForm?.festival.id;
    if (!mandalId || !festivalId) {
      showToast('Active mandal festival not found. Refresh and try again.');
      return;
    }

    setEntriesExporting('pdf');
    try {
      const { blob, fileName } = await apiDownload(
        `/mandals/${mandalId}/festivals/${festivalId}/reports/collections.pdf`,
        session,
      );
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName || `${slugify(mandal.name)}-financial-report.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      showToast('Accounting PDF downloaded successfully.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not download accounting PDF.');
    } finally {
      setEntriesExporting(null);
    }
  }

  async function saveTemplate(placements: Record<string, TemplatePlacement>) {
    await onTemplateSaved(placements);
    showToast('Template saved successfully.');
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  function openScreen(nextScreen: AdhyakshScreen) {
    setScreen(nextScreen);
    writeRoute(routeForAdhyaksh(nextScreen));
    closeSidebar();
  }

  useEffect(() => {
    if (!parseAdhyakshRoute()) {
      writeRoute(routeForAdhyaksh(screen), 'replace');
    }

    function syncScreenFromRoute() {
      const nextScreen = parseAdhyakshRoute();
      if (nextScreen) setScreen(nextScreen);
    }

    window.addEventListener('hashchange', syncScreenFromRoute);
    window.addEventListener('popstate', syncScreenFromRoute);
    return () => {
      window.removeEventListener('hashchange', syncScreenFromRoute);
      window.removeEventListener('popstate', syncScreenFromRoute);
    };
  }, [screen]);

  function pageTitle() {
    return {
      expenses: 'Expenses',
      form: 'Form Management',
      logs: 'Logs',
      members: 'Members',
      slips: 'Vargani Slips',
      tasks: 'Tasks',
      template: 'Vargani Template',
      users: 'User Management',
    }[screen];
  }

  return (
    <main className={`member-shell adhyaksh-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="mobile-workspace-bar">
        <div className="mobile-workspace-brand">
          <img alt="Samavet" src="/samavet-logo-transparent.png" />
          <div>
            <strong>ePawati</strong>
            <small>{mandalIdentity.name}</small>
          </div>
        </div>
        <div className="mobile-workspace-actions">
          <div aria-label={`Signed in as ${session.user.name}`} className="mobile-user-avatar" title={session.user.name}>
            {session.user.name.charAt(0)}
          </div>
          <button aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'} className="mobile-menu-toggle" onClick={() => setSidebarOpen((open) => !open)} type="button">
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {sidebarOpen && <button aria-label="Close menu" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} type="button" />}
      <aside className="member-sidebar adhyaksh-sidebar">
        <div className="portal-brand">
          <img alt="Samavet" src="/samavet-logo-transparent.png" />
          <div><strong>Samavet</strong><span>ePawati</span></div>
        </div>
        <div className="mandal-identity">
          {mandalIdentity.logoUrl ? <img alt="" className="mandal-avatar-img" src={mandalIdentity.logoUrl} /> : <span className="mandal-seal">{mandalIdentity.initials}</span>}
          <div>
            <strong>{mandalIdentity.name}</strong>
            <small>{mandalIdentity.location}</small>
          </div>
        </div>
        <div className="mandal-contact-card">
          <span>{mandalIdentity.address}</span>
          <span>{mandalIdentity.phone}</span>
        </div>
        <nav className="adhyaksh-nav">
          {adhyakshNavItems.map((item) => (
            <button
              className={screen === item.id ? 'active' : ''}
              key={item.id}
              onClick={() => openScreen(item.id)}
              type="button"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="logout" onClick={() => { closeSidebar(); onLogout(); }} type="button">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <section className="member-content adhyaksh-content">
        <header className="adhyaksh-header">
          <h1>{pageTitle()}</h1>
          <div className="adhyaksh-header-actions">
            <button disabled={busy || workspaceRefreshing} onClick={onRefresh} type="button"><RefreshCw size={17} className={workspaceRefreshing ? 'spin-icon' : ''} />{workspaceRefreshing ? 'Syncing' : 'Refresh'}</button>
            <label className="year-select">
              <span>{yearChanging ? 'Switching...' : 'Active Year'}</span>
              <select
                aria-label="Active year"
                disabled={busy || workspaceRefreshing || yearChanging}
                onChange={(event) => void onYearChange(Number(event.currentTarget.value))}
                value={activeYear ?? currentYear}
              >
                {yearOptions.map((year) => <option key={year} value={year}>Year {year}</option>)}
              </select>
            </label>
            <div className="top-user mini">
              <span>{session.user.name.charAt(0)}</span>
              <div>
                <strong title={session.user.name}>{session.user.name}</strong>
                <small>{session.user.role.replaceAll('_', ' ')}</small>
              </div>
            </div>
          </div>
        </header>
        {displayNotice && <div className={`notice show ${busy ? 'busy' : ''}`}>{displayNotice}</div>}

        {screen === 'members' && (
          <section className="adhyaksh-page">
            <div className="wide-card action-card">
              <div>
                <h2>Member directory</h2>
                <span>Manage members, groups and annual contribution records.</span>
              </div>
              <button className="blue-action" onClick={() => { setMemberSubmitAttempted(false); setMemberOpen(true); }} type="button"><Plus size={18} />Add Member</button>
            </div>
            <div className="metric-strip six">
              <Metric label="Total Members" value={metricValue(String(memberRows.length))} />
              <Metric green label="Member Vargani" note={metricNote(`${memberPaidCount} Members Paid`)} value={metricValue(money(memberVargani))} />
              <Metric green label="Slip Vargani" note={metricNote(`${paidSlipCount} Slips Paid`)} value={metricValue(money(paidSlipAmount))} />
              <Metric red label="Pending (Members)" note={metricNote(`${memberPendingCount} Pending`)} value={metricValue(money(pendingMemberVargani))} />
              <Metric label="Mandal Expenses" note={metricNote('Paid by Mandal')} tone="warning" value={metricValue(money(expensesTotal))} />
              <Metric label="Remaining Balance" note={metricNote('Available Funds')} tone="approved" value={metricValue(money(balance))} />
            </div>
            <div className="wide-card groups-card">
              <div>
                <h2>Collection groups</h2>
                <span>Organize area-wise teams and assign collection leaders.</span>
              </div>
              <button className="blue-action" onClick={() => setGroupOpen(true)} type="button"><Plus size={18} />Add Group</button>
              <div className="group-list">
                {groups.length === 0 && <span className="soft-empty">No groups created yet. Add groups like Main Road, Bazaar Lane, or Sponsor Team.</span>}
                {groupsWithStats.map((group) => (
                  <article className="group-chip-card" key={group.id}>
                    <div className="group-chip-top">
                      <div>
                        <strong>{group.name}</strong>
                        {group.areaName && <span>{group.areaName}</span>}
                      </div>
                      <b>{money(group.collected)}</b>
                    </div>
                    <div className="group-chip-metrics">
                      <span>{group.memberCount} members</span>
                      <span>{group.slipCount} paid slips</span>
                    </div>
                    <label className="group-leader-picker">
                      <span>Leader</span>
                      <select
                        value={group.leader?.id ?? ''}
                        onChange={(event) => void onUpdateGroup(group.id, { leaderUserId: event.target.value || null })}
                      >
                        <option value="">Assign leader</option>
                        {members.map((member) => {
                          const userId = memberUserId(member);
                          return userId ? <option key={member.id} value={userId}>{member.displayName}</option> : null;
                        })}
                      </select>
                    </label>
                    <div className="group-member-preview">
                      {group.memberRows.length === 0 && <small>No members linked yet.</small>}
                      {group.memberRows.slice(0, 5).map((row) => (
                        <small key={row.member.id}>
                          <span>{row.name}{row.isLeader && <em className="leader-badge">Leader</em>}</span>
                          <b>{money(row.collected)}</b>
                        </small>
                      ))}
                      {group.memberRows.length > 5 && <small>+{group.memberRows.length - 5} more members</small>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="ops-table members-table">
              <div className="ops-head members-head"><span>Name & Role</span><span>Group</span><span>Contact</span><span>Collected by user</span><span>Vargani (2026)</span><span>Actions</span></div>
              {isInitialSync && <EmptyTableState message="Loading live member data..." />}
              {workspaceLoaded && memberRows.length === 0 && <EmptyTableState message="No members added yet." />}
              {memberRows.map((member) => (
                <div className="ops-row member-row" key={member.member.id}>
                  <strong>{member.name}<small>{member.role}</small></strong>
                  <label className={`member-group-control ${member.isOrphanLeader ? 'needs-group' : member.rawGroupId ? '' : 'no-group'}`}>
                    <select
                      value={member.rawGroupId}
                      onChange={(event) => void onAssignMemberGroup(member.member, event.target.value)}
                    >
                      <option value="">No group</option>
                      {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                    {member.isOrphanLeader && <small>Leader role without a group</small>}
                  </label>
                  <span>{member.contact}</span>
                  <span><b>{money(member.collected)}</b><small>{member.paidSlipCount} slips collected</small></span>
                  <span><b>{money(member.vargani)}</b><i className={member.paid ? 'pill paid' : 'pill pending'}>{member.paid ? 'Paid' : 'Pending'}</i></span>
                  <span className="row-actions">
                    <button onClick={() => void onEditMember(member.member)} type="button"><Edit3 size={16} /></button>
                    <button onClick={() => onRemindMember(member.member)} type="button"><MessageSquare size={16} /></button>
                    <button onClick={() => void onArchiveMember(member.member)} type="button"><Trash2 size={16} /></button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {screen === 'tasks' && (
          <section className="adhyaksh-page">
            <div className="wide-card action-card">
              <div><h2>Task Board (2026)</h2><span>Assign festival work and monitor open responsibilities.</span></div>
              <button className="blue-action" onClick={() => { setEditingTask(null); setTaskOpen(true); }} type="button"><Plus size={18} />Add Task</button>
            </div>
            <div className="metric-strip">
              <Metric label="Open Tasks" value={String(tasks.filter((task) => task.status !== 'DONE').length)} />
              <Metric blue label="Teams Assigned" value={String(new Set(tasks.map((task) => task.assignee?.name).filter(Boolean)).size)} />
              <Metric green label="This Week" value={String(tasks.length)} />
            </div>
            <div className="ops-table tasks-table">
              <div className="ops-head five"><span>Task</span><span>Owner / Group</span><span>Due Date</span><span>Status</span><span>Actions</span></div>
              {tasks.length === 0 && <EmptyTableState message="No tasks added yet." />}
              {tasks.map((task) => (
                <div className="ops-row five" key={task.id}>
                  <strong>{task.title}<small>{task.notes || 'No notes'}</small></strong>
                  <span>{task.assignee?.name ?? 'Unassigned'}<small>{task.group?.name ?? 'No group'}</small></span>
                  <span>{task.dueDate?.slice(0, 10) ?? '-'}</span>
                  <span><i className={task.status === 'DONE' ? 'pill paid' : 'pill pending'}>{task.status}</i><i className="pill mode">{task.priority}</i></span>
                  <span className="row-actions">
                    <button onClick={() => void onTaskDone(task)} type="button"><CheckCircle2 size={16} /></button>
                    <button onClick={() => { setEditingTask(task); setTaskOpen(true); }} type="button"><Edit3 size={16} /></button>
                    <button onClick={() => void onDeleteTask(task)} type="button"><Trash2 size={16} /></button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {screen === 'expenses' && (
          <section className="adhyaksh-page expenses-page">
            <div className="wide-card action-card">
              <div><h2>Expenses (2026)</h2><span>Total for 2026: <b>{money(expensesTotal)}</b></span></div>
              <button className="blue-action" onClick={() => { setExpenseProofName(''); setExpenseOpen(true); }} type="button"><Plus size={18} />Add Expense</button>
            </div>
            <div className="ops-table expenses-table">
              <div className="ops-head six"><span>Description</span><span>Vendor</span><span>Paid By</span><span>Category</span><span>Date</span><span>Amount</span><span>Refund?</span><span>Actions</span></div>
              {expenses.length === 0 && <EmptyTableState message="No expenses added yet." />}
              {expenses.map((expense) => (
                <div className="ops-row six" key={expense.id}>
                  <strong>
                    {expense.notes || 'Expense'}
                    {expense.billFileUrl && <a className="expense-proof-link" href={expense.billFileUrl} rel="noreferrer" target="_blank"><Eye size={14} />View proof</a>}
                  </strong><span>{expense.vendorName || '-'}</span><i className="pill role">{expense.creator?.name ?? session.user.name}</i><span>{expense.category?.name ?? 'Miscellaneous'}</span><span>{expense.expenseDate.slice(0, 10)}</span><b>{money(Number(expense.amount))}</b><i className="pill pending">{expense.status}</i>
                  <span className="row-actions">
                    <button onClick={() => void onEditExpense(expense)} type="button"><Edit3 size={16} /></button>
                    <button onClick={() => void onDeleteExpense(expense)} type="button"><Trash2 size={16} /></button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {screen === 'template' && (
          <section className="adhyaksh-page">
            <div className="wide-card action-card">
              <div>
                <h2>Vargani Template</h2>
                <span>Upload slip artwork, drag fields, resize boxes, and tune font styles.</span>
              </div>
              <button className="blue-action" onClick={onRefresh} type="button"><RefreshCw size={18} />Sync Template</button>
            </div>
            <TemplateView
              activeForm={activeForm}
              activeTemplate={activeTemplate}
              latestTemplateVersion={latestTemplateVersion}
              onAddField={onAddTemplateField}
              onPreviewChange={onPreviewChange}
              onPrompt={onPrompt}
              onSaveTemplate={saveTemplate}
              templatePreview={templatePreview}
            />
          </section>
        )}

        {screen === 'slips' && (
          <section className="adhyaksh-page">
            <div className="wide-card action-card">
              <div><h2>Vargani Slips</h2><span>Generate and manage vargani receipts.</span></div>
              <div className="vargani-page-actions">
                <button disabled={entriesExporting !== null} onClick={() => void downloadAllVarganiEntries()} type="button"><Download size={18} />{entriesExporting === 'excel' ? 'Preparing Excel...' : 'Download Excel'}</button>
                <button disabled={entriesExporting !== null} onClick={() => void downloadAccountingPdf()} type="button"><FileText size={18} />{entriesExporting === 'pdf' ? 'Preparing PDF...' : 'Accounting PDF'}</button>
                <button className="blue-action" onClick={() => setEntryOpen(true)} type="button"><Plus size={18} />New Vargani Entry</button>
              </div>
            </div>
            <div className="metric-strip five-cols">
              <Metric label="Total Entries" note={metricNote(mandal?.slipLimit ? `Plan limit: ${mandal.slipLimit} slips` : 'Unlimited plan')} value={metricValue(String(totalSlipCount))} />
              <Metric green label="Collected" note={metricNote(`${paidSlipCount} Paid`)} value={metricValue(money(paidSlipAmount))} />
              <Metric red label="Pending" note={metricNote(`${pendingSlipCount} Pending`)} value={metricValue(money(totalPendingSlipAmount))} />
              <Metric green label="Paid Slips" value={metricValue(String(paidSlipCount))} />
              <Metric blue label="Pending Slips" value={metricValue(String(pendingSlipCount))} />
            </div>
            <div className="slip-insights">
              <div className="insight-card warning">
                <strong>Pending Location-wise ({money(totalPendingSlipAmount)})</strong>
                <div className="chips">
                  {pendingSlipRows.length === 0 ? <span>No pending slips</span> : pendingSlipRows.map((slip) => (
                    <span key={`${slip.id}-pending`}>{slip.areaName || 'No area'} {money(Number(slip.amount || 0))}</span>
                  ))}
                </div>
              </div>
              <div className="insight-card blue">
                <strong>Slips Generated</strong>
                <div className="chips">{totalSlipCount === 0 ? <span>No slips generated</span> : <span>{totalSlipCount} Live Slips</span>}</div>
              </div>
            </div>
            <div className="table-toolbar">
              <div className="segmented">
                <button className={slipFilter === 'all' ? 'active' : ''} onClick={() => setSlipFilter('all')} type="button">All ({totalSlipCount})</button>
                <button className={slipFilter === 'paid' ? 'active' : ''} onClick={() => setSlipFilter('paid')} type="button">Paid ({paidSlipCount})</button>
                <button className={slipFilter === 'pending' ? 'active' : ''} onClick={() => setSlipFilter('pending')} type="button">Pending ({pendingSlipCount})</button>
              </div>
              <label className="slip-filter-control">
                <span>Created by</span>
                <select onChange={(event) => setSlipCreatorFilter(event.target.value)} value={slipCreatorFilter}>
                  <option value="">All members</option>
                  {slipCreators.map(([userId, name]) => <option key={userId} value={userId}>{name}</option>)}
                </select>
              </label>
              <label className="slip-filter-control">
                <span>Date</span>
                <input onChange={(event) => setSlipDateFilter(event.target.value)} type="date" value={slipDateFilter} />
              </label>
              <label className="search-inline"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, location, admin, date..." /></label>
            </div>
            <div className="ops-table slips-table">
              <div className="ops-head six"><span>Slip #</span><span>Name / Shop</span><span>Amount</span><span>Mobile</span><span>Status / Mode</span><span>Date / Created By</span><span>Actions</span></div>
              {isInitialSync && <EmptyTableState message="Loading live slip data..." />}
              {workspaceLoaded && filteredSlipRows.length === 0 && <EmptyTableState message="No slips found for this filter." />}
              {filteredSlipRows.map((slip) => (
                <div className="ops-row six" key={slip.id}>
                  <b>{slip.slipNumber}</b><strong>{slip.contributorName}<small>{slip.shopName ?? '-'}</small><small className="slip-address">{slip.contributorAddress || 'Address not added'}</small></strong><b>{money(Number(slip.amount))}</b><span>{slip.contributorPhone ?? '-'}</span>
                  <span><i className={isSlipPaid(slip) ? 'pill paid' : 'pill pending'}>{isSlipPaid(slip) ? 'Paid' : 'Pending'}</i><i className="pill mode">{slip.paymentMode}</i></span>
                  <span>{new Date(slip.createdAt).toLocaleDateString('en-IN')}<small>Created by {slip.collector?.name || 'Unknown user'}</small></span>
                  <span className="row-actions">
                    <button onClick={() => { setSelectedSlip(slip); void onEditSlip(slip); }} type="button"><Edit3 size={16} />Edit</button>
                    <button className="mini-link" onClick={() => { setSelectedSlip(slip); void onDownloadSlip(slip); }} type="button"><Download size={16} />Slip</button>
                    <button className="whatsapp-action" onClick={() => { setSelectedSlip(slip); void onShareSlip(slip); }} type="button"><WhatsAppIcon />WhatsApp</button>
                    <button aria-label={`Delete ${slip.slipNumber}`} onClick={() => void onDeleteSlip(slip)} title="Delete slip" type="button"><Trash2 size={16} /></button>
                  </span>
                </div>
              ))}
              {slipMeta.page < slipMeta.totalPages && (
                <div className="table-load-more">
                  <button disabled={loadingMoreSlips} onClick={() => void onLoadMoreSlips()} type="button">
                    {loadingMoreSlips ? 'Loading entries...' : `Load more (${slipRows.length} of ${slipMeta.total})`}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {screen === 'form' && (
          <FormManagementView
            activeForm={activeForm}
            busy={busy}
            entryFields={entryFields}
            onCreateField={onCreateCustomField}
            onDeleteField={onDeleteCustomField}
            onPrompt={onPrompt}
            onUpdateField={onUpdateCustomField}
            onUpdateEntryField={onUpdateEntryField}
          />
        )}

        {screen === 'users' && (
          <section className="adhyaksh-page">
            <div className="wide-card action-card">
              <div><h2>User Management</h2><span>Admins, sub-admins, and collection access.</span></div>
              <label className="search-inline"><Search size={18} /><input placeholder="Search users..." /></label>
            </div>
            <div className="metric-strip">
              <Metric label="Total Users" value={String(userRows.length)} />
              <Metric blue label="Admins" value={String(userRows.filter((user) => user.role.includes('ADMIN')).length)} />
              <Metric blue label="Members" value={String(userRows.filter((user) => !user.role.includes('ADMIN')).length)} />
              <Metric green label="Total Entries" value={String(totalSlipCount)} />
            </div>
            <div className="ops-table users-table">
              <div className="ops-head five"><span>User</span><span>Email</span><span>Role</span><span>Entries</span><span>Actions</span></div>
              {userRows.map((user) => (
                <div className="ops-row five" key={`${user.name}-${user.email}`}>
                  <strong><span className="avatar tiny">{user.name.charAt(0).toUpperCase()}</span>{user.name}<small>{user.joined}</small></strong>
                  <span>{user.email}</span><i className="pill role">{user.role}</i><span>{user.entries}</span>
                  <span className="row-actions"><button onClick={() => user.member ? void onEditMember(user.member) : showToast('Super admin controls the main admin role.')} type="button"><UserCog size={16} />Edit Role</button></span>
                </div>
              ))}
            </div>
          </section>
        )}

        {screen === 'logs' && (
          <section className="adhyaksh-page">
            <div className="wide-card action-card">
              <div><h2>Activity History</h2><span>Real-time logs for receipts, payments, and users.</span></div>
              <span className="real-time"><History size={18} />Real-time Logs</span>
            </div>
            <div className="ops-table logs-table">
              <div className="ops-head"><span>Time & Date</span><span>User</span><span>Action</span><span>Details</span></div>
              {slipRows.length === 0 && <EmptyTableState message="No activity yet." />}
              {slipRows.slice(0, 8).map((slip) => {
                const createdAt = formatLogTimestamp(slip.createdAt);
                return (
                <div className="ops-row" key={`${slip.id}-log`}>
                  <span><b>{createdAt.date}</b><small>{createdAt.time}</small></span>
                  <i className="pill role">{slip.collector?.name || session.user.name}</i>
                  <strong>VARGANI SLIP CREATED</strong>
                  <span>Slip {slip.slipNumber} for {slip.contributorName} - {money(Number(slip.amount))} (paid)</span>
                </div>
              );
              })}
            </div>
          </section>
        )}
      </section>

      {entryOpen && (
        <div className="modal-backdrop">
          <form className="vargani-modal adhyaksh-modal" onSubmit={async (event) => {
            setModalSubmitting('entry');
            try {
              const ok = await onGenerate(event);
              if (!ok) return;
              setEntryOpen(false);
              setEntryStatus('ACTIVE');
            } finally {
              setModalSubmitting(null);
            }
          }}>
            <button className="modal-close" disabled={modalSubmitting === 'entry'} onClick={() => setEntryOpen(false)} type="button"><X size={20} /></button>
            <h2>New Vargani Entry</h2>
            <EntryCoreFields
              entryFields={entryFields}
              entryStatus={entryStatus}
              groups={groups}
              onEntryStatusChange={setEntryStatus}
              session={session}
            />
            {(activeForm?.customFields ?? []).map((field) => <CustomFieldInput field={field} key={field.id} />)}
            <div className="modal-actions"><button disabled={modalSubmitting === 'entry'} type="button" onClick={() => setEntryOpen(false)}>Cancel</button><button className={entryStatus === 'PENDING' ? 'pending-action' : 'success'} disabled={modalSubmitting === 'entry'} onClick={(event) => { if (event.currentTarget.form?.checkValidity()) onPrepareWhatsApp(entryStatus); }} type="submit">{entryStatus === 'PENDING' ? <Clock size={18} /> : <CheckCircle2 size={18} />}{modalSubmitting === 'entry' ? 'Saving...' : entryStatus === 'PENDING' ? 'Save as Pending' : 'Confirm & Generate Slip'}</button></div>
          </form>
        </div>
      )}

      {groupOpen && (
        <div className="modal-backdrop">
          <form className="vargani-modal adhyaksh-modal" onSubmit={async (event) => {
            setModalSubmitting('group');
            try {
              const ok = await onCreateGroup(event);
              if (ok) setGroupOpen(false);
            } finally {
              setModalSubmitting(null);
            }
          }}>
            <button className="modal-close" disabled={modalSubmitting === 'group'} onClick={() => setGroupOpen(false)} type="button"><X size={20} /></button>
            <h2>Add Collection Group</h2>
            <label>Group Name<input name="name" required placeholder="Main Road Team" /></label>
            <label>Area / Locality<input name="areaName" placeholder="Main Road, Lohgaon" /></label>
            <label>
              Group Leader
              <select name="leaderUserId" defaultValue="">
                <option value="">Assign later</option>
                {members.map((member) => {
                  const userId = memberUserId(member);
                  return userId ? <option key={member.id} value={userId}>{member.displayName}</option> : null;
                })}
              </select>
            </label>
            <div className="modal-actions">
              <button disabled={modalSubmitting === 'group'} type="button" onClick={() => setGroupOpen(false)}>Cancel</button>
              <button className="blue-action" disabled={modalSubmitting === 'group'} type="submit">{modalSubmitting === 'group' ? 'Creating...' : 'Create Group'}</button>
            </div>
          </form>
        </div>
      )}

      {taskOpen && (
        <div className="modal-backdrop">
          <form
            className="vargani-modal adhyaksh-modal"
            onSubmit={async (event) => {
              setModalSubmitting('task');
              try {
                if (editingTask) {
                  await onEditTask(editingTask, event);
                } else {
                  const ok = await onCreateTask(event);
                  if (!ok) return;
                }
                setTaskOpen(false);
                setEditingTask(null);
              } finally {
                setModalSubmitting(null);
              }
            }}
          >
            <button className="modal-close" disabled={modalSubmitting === 'task'} onClick={() => { setTaskOpen(false); setEditingTask(null); }} type="button"><X size={20} /></button>
            <h2>{editingTask ? 'Edit Task' : 'Add Task'}</h2>
            <label>Task Name<input name="title" required defaultValue={editingTask?.title ?? ''} placeholder="Collect pending vargani from Main Road" /></label>
            <label>
              Assign To
              <select name="assigneeUserId" defaultValue={editingTask?.assigneeUserId ?? ''}>
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.user?.id ?? ''}>{member.displayName} ({member.user?.role?.replaceAll('_', ' ') ?? 'Member'})</option>
                ))}
              </select>
            </label>
            <label>
              Group / Area
              <select name="groupId" defaultValue={editingTask?.groupId ?? ''}>
                <option value="">No group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}{group.areaName ? ` - ${group.areaName}` : ''}</option>
                ))}
              </select>
            </label>
            <label>Due Date<input name="dueDate" defaultValue={editingTask?.dueDate?.slice(0, 10) ?? ''} type="date" /></label>
            <label>
              Priority
              <select name="priority" defaultValue={editingTask?.priority ?? 'MEDIUM'}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue={editingTask?.status ?? 'OPEN'}>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <label className="full">Notes<textarea name="notes" defaultValue={editingTask?.notes ?? ''} placeholder="What needs to be done, where, and any phone/payment detail." /></label>
            <div className="modal-actions">
              <button disabled={modalSubmitting === 'task'} type="button" onClick={() => { setTaskOpen(false); setEditingTask(null); }}>Cancel</button>
              <button className="blue-action" disabled={modalSubmitting === 'task'} type="submit">{modalSubmitting === 'task' ? 'Saving...' : editingTask ? 'Save Task' : 'Create Task'}</button>
            </div>
          </form>
        </div>
      )}

      {memberOpen && (
        <div className="modal-backdrop">
          <form className="vargani-modal adhyaksh-modal" onSubmit={async (event) => {
            setMemberSubmitAttempted(true);
            setModalSubmitting('member');
            try {
              const ok = await onCreateMember(event);
              if (ok) setMemberOpen(false);
            } finally {
              setModalSubmitting(null);
            }
          }}>
            <button className="modal-close" disabled={modalSubmitting === 'member'} onClick={() => { setMemberSubmitAttempted(false); setMemberOpen(false); }} type="button"><X size={20} /></button>
            <h2>Add Member</h2>
            <p className="modal-help">Create member login here. Make someone a group leader from Collection Groups.</p>
            {memberSubmitAttempted && notice && <div className="member-create-feedback" role="alert">{notice}</div>}
            <label>Member Name<input name="name" required placeholder="Member name" /></label>
            <label>Login Username (Email)<input autoComplete="username" name="email" required placeholder="member@example.com" type="email" /></label>
            <label>
              Mobile Number (Optional)
              <span className="phone-input-group">
                <b>+91</b>
                <input inputMode="numeric" maxLength={10} name="phone" pattern="[6-9][0-9]{9}" placeholder="9876543210" title="Enter a valid 10-digit Indian mobile number" type="tel" />
              </span>
            </label>
            <label>Login Password<input autoComplete="new-password" minLength={8} name="password" required placeholder="Minimum 8 characters" type="password" /></label>
            <label>Group<select name="groupId"><option value="">No group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            <label>Area<input name="areaName" placeholder="Market Area" /></label>
            <div className="modal-actions"><button disabled={modalSubmitting === 'member'} type="button" onClick={() => { setMemberSubmitAttempted(false); setMemberOpen(false); }}>Cancel</button><button className="blue-action" disabled={modalSubmitting === 'member'} type="submit">{modalSubmitting === 'member' ? 'Creating...' : 'Create Member Login'}</button></div>
          </form>
        </div>
      )}

      {expenseOpen && (
        <div className="modal-backdrop">
          <form className="vargani-modal adhyaksh-modal" onSubmit={async (event) => {
            setModalSubmitting('expense');
            try {
              const ok = await onCreateExpense(event);
              if (ok) {
                setExpenseProofName('');
                setExpenseOpen(false);
              }
            } finally {
              setModalSubmitting(null);
            }
          }}>
            <button aria-label="Close add expense" className="modal-close" disabled={modalSubmitting === 'expense'} onClick={() => { setExpenseProofName(''); setExpenseOpen(false); }} type="button"><X size={20} /></button>
            <h2>Add Expense</h2>
            <label>Description<input name="description" required placeholder="Expense description" /></label>
            <label>Vendor<input name="vendor" placeholder="Vendor name" /></label>
            <label>Paid By<input name="paidBy" placeholder="Member name" /></label>
            <label>Category<input name="category" placeholder="Decoration, sound..." /></label>
            <label>Date<input name="date" type="date" /></label>
            <label>Amount<input name="amount" inputMode="numeric" required placeholder="3500" /></label>
            <div className="expense-proof-field">
              <span className="expense-proof-heading"><span><Upload size={17} />Proof photo</span><em>Optional</em></span>
              <div className="expense-proof-control">
                <label className="expense-proof-picker">
                  Choose photo
                  <input accept="image/jpeg,image/png,image/webp" name="proofPhoto" onChange={(event) => setExpenseProofName(event.target.files?.[0]?.name ?? '')} type="file" />
                </label>
                <span>{expenseProofName || 'No photo selected'}</span>
              </div>
              <small>Attach a bill, invoice, or payment screenshot. JPG, PNG, or WebP up to 6 MB.</small>
            </div>
            <div className="modal-actions"><button disabled={modalSubmitting === 'expense'} type="button" onClick={() => { setExpenseProofName(''); setExpenseOpen(false); }}>Cancel</button><button className="blue-action" disabled={modalSubmitting === 'expense'} type="submit">{modalSubmitting === 'expense' ? 'Saving...' : 'Save Expense'}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}

type MetricTone = 'approved' | 'danger' | 'neutral' | 'success' | 'warning';

function Metric({ blue, green, label, note, red, tone, value }: { blue?: boolean; green?: boolean; label: string; note?: string; red?: boolean; tone?: MetricTone; value: string }) {
  const semanticTone: MetricTone = tone ?? (green ? 'success' : red ? 'danger' : 'neutral');

  return (
    <article className={`metric-card ${green ? 'green' : ''} ${red ? 'red' : ''} ${blue ? 'neutral' : ''} tone-${semanticTone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

function EmptyTableState({ message }: { message: string }) {
  return (
    <div className="empty-state inline">
      <ReceiptText size={28} />
      <strong>{message}</strong>
    </div>
  );
}

function EntryCoreFields({
  entryFields,
  entryStatus,
  groups = [],
  onEntryStatusChange,
  session,
}: {
  entryFields: EntryFieldConfig[];
  entryStatus: 'ACTIVE' | 'PENDING';
  groups?: Group[];
  onEntryStatusChange: (status: 'ACTIVE' | 'PENDING') => void;
  session: AuthSession;
}) {
  const field = (key: EntryFieldKey) =>
    entryFields.find((item) => item.key === key) ?? DEFAULT_ENTRY_FIELDS.find((item) => item.key === key)!;
  const visible = (key: EntryFieldKey) => field(key).visible;
  const label = (key: EntryFieldKey) => `${field(key).label}${field(key).required ? ' *' : ''}`;

  return (
    <>
      <ContributorNameFields
        marathiField={field('contributorNameMr')}
        nameField={field('contributorName')}
        session={session}
      />
      {visible('shopName') && <label>{label('shopName')}<input name="shopName" required={field('shopName').required} placeholder="Enter shop / business name" /></label>}
      {visible('amount') && <label>{label('amount')}<input inputMode="numeric" name="amount" required={field('amount').required} placeholder="1500" /></label>}
      {visible('areaName') && <label>{label('areaName')}<input name="areaName" required={field('areaName').required} placeholder="Main Road, Pune" /></label>}
      {visible('groupId') && (
        <label>
          {label('groupId')}
          <select name="groupId" required={field('groupId').required} defaultValue="">
            <option value="">No group</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}{group.areaName ? ` - ${group.areaName}` : ''}</option>
            ))}
          </select>
        </label>
      )}
      <ContributorAddressFields
        addressField={field('contributorAddress')}
        marathiField={field('contributorAddressMr')}
        session={session}
      />
      {visible('contributorPhone') && (
        <label>
          {label('contributorPhone')}
          <span className="phone-input-group">
            <b aria-label="India country code plus ninety-one">+91</b>
            <input
              autoComplete="tel-national"
              inputMode="numeric"
              maxLength={10}
              minLength={10}
              name="contributorPhone"
              onInput={(event) => { event.currentTarget.value = nationalIndianMobileNumber(event.currentTarget.value); }}
              onPaste={(event) => {
                event.preventDefault();
                event.currentTarget.value = nationalIndianMobileNumber(event.clipboardData.getData('text'));
              }}
              pattern="[6-9][0-9]{9}"
              placeholder="9876543210"
              required={field('contributorPhone').required}
              title="Enter a valid 10-digit Indian WhatsApp number"
              type="tel"
            />
          </span>
        </label>
      )}
      {visible('paymentStatus') ? (
        <PaymentStatusSelector value={entryStatus} onChange={onEntryStatusChange} />
      ) : (
        <input name="paymentStatus" type="hidden" value="ACTIVE" />
      )}
      {visible('paymentMode') ? (
        <label>
          {label('paymentMode')}
          <select name="paymentMode" required={field('paymentMode').required} defaultValue="CASH">
            <option value="CASH">Cash</option>
            <option value="UPI">Online / UPI</option>
            <option value="CHEQUE">Cheque</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </label>
      ) : (
        <input name="paymentMode" type="hidden" value="CASH" />
      )}
      {entryStatus === 'PENDING' && visible('tentativePaymentDate') && (
        <label className="pending-date-card">{label('tentativePaymentDate')}<input name="tentativePaymentDate" required={field('tentativePaymentDate').required} type="date" /></label>
      )}
    </>
  );
}

function ContributorNameFields({
  marathiField = DEFAULT_ENTRY_FIELDS[1],
  nameField = DEFAULT_ENTRY_FIELDS[0],
  session,
}: {
  marathiField?: EntryFieldConfig;
  nameField?: EntryFieldConfig;
  session: AuthSession;
}) {
  const [name, setName] = useState('');
  const [marathiName, setMarathiName] = useState('');
  const [manualMarathi, setManualMarathi] = useState(false);

  const autoMarathiName = useMemo(() => transliterateReceiptTextToMarathi(name).trim(), [name]);

  useEffect(() => {
    if (manualMarathi || !name.trim()) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void requestMarathiTranslation(name, session, controller.signal)
        .then((suggestion) => setMarathiName(suggestion))
        .catch(() => undefined);
    }, 450);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [manualMarathi, name, session]);

  function updateName(nextName: string) {
    setName(nextName);
    if (!manualMarathi) {
      setMarathiName(transliterateReceiptTextToMarathi(nextName).trim());
    }
  }

  function updateMarathiName(nextName: string) {
    setMarathiName(nextName);
    setManualMarathi(Boolean(nextName.trim()) && nextName.trim() !== autoMarathiName);
  }

  return (
    <>
      {nameField.visible && <label>{nameField.label}{nameField.required ? ' *' : ''}<input name="contributorName" onChange={(event) => updateName(event.currentTarget.value)} required={nameField.required} placeholder="Enter full name" value={name} /></label>}
      {marathiField.visible && <label>{marathiField.label}{marathiField.required ? ' *' : ''}<input name="contributorNameMr" onChange={(event) => updateMarathiName(event.currentTarget.value)} required={marathiField.required} placeholder="Auto Marathi name" value={marathiName} /></label>}
    </>
  );
}

function ContributorAddressFields({
  addressField = DEFAULT_ENTRY_FIELDS.find((field) => field.key === 'contributorAddress')!,
  marathiField = DEFAULT_ENTRY_FIELDS.find((field) => field.key === 'contributorAddressMr')!,
  session,
}: {
  addressField?: EntryFieldConfig;
  marathiField?: EntryFieldConfig;
  session: AuthSession;
}) {
  const [address, setAddress] = useState('');
  const [marathiAddress, setMarathiAddress] = useState('');
  const [manualMarathi, setManualMarathi] = useState(false);

  const autoMarathiAddress = useMemo(() => transliterateReceiptTextToMarathi(address).trim(), [address]);

  useEffect(() => {
    if (manualMarathi || !address.trim()) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void requestMarathiTranslation(address, session, controller.signal)
        .then((suggestion) => setMarathiAddress(suggestion))
        .catch(() => undefined);
    }, 450);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [address, manualMarathi, session]);

  function updateAddress(nextAddress: string) {
    setAddress(nextAddress);
    if (!manualMarathi) setMarathiAddress(transliterateReceiptTextToMarathi(nextAddress).trim());
  }

  function updateMarathiAddress(nextAddress: string) {
    setMarathiAddress(nextAddress);
    setManualMarathi(Boolean(nextAddress.trim()) && nextAddress.trim() !== autoMarathiAddress);
  }

  return (
    <>
      {addressField.visible && (
        <label>
          {addressField.label}{addressField.required ? ' *' : ''}
          <textarea
            name="contributorAddress"
            onChange={(event) => updateAddress(event.currentTarget.value)}
            placeholder="Full address optional"
            required={addressField.required}
            value={address}
          />
        </label>
      )}
      {marathiField.visible && (
        <label>
          {marathiField.label}{marathiField.required ? ' *' : ''}
          <textarea
            lang="mr"
            name="contributorAddressMr"
            onChange={(event) => updateMarathiAddress(event.currentTarget.value)}
            placeholder="Auto-filled; review Marathi spelling"
            required={marathiField.required}
            value={marathiAddress}
          />
          <small>Review names, buildings and localities before generating the slip.</small>
        </label>
      )}
    </>
  );
}

function CustomFieldInput({ field }: { field: CustomField }) {
  const name = `custom_${field.key}`;
  const label = `${field.label}${field.required ? ' *' : ''}`;
  const type = field.type.toUpperCase();

  if (type === 'DROPDOWN') {
    return (
      <label>
        {label}
        <select name={name} required={field.required} defaultValue="">
          <option value="">Select {field.label}</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  if (type === 'LONG_TEXT') {
    return <label>{label}<textarea name={name} required={field.required} /></label>;
  }

  if (type === 'NUMBER') {
    return <label>{label}<input inputMode="numeric" name={name} required={field.required} /></label>;
  }

  if (type === 'DATE') {
    return <label>{label}<input name={name} required={field.required} type="date" /></label>;
  }

  if (type === 'CHECKBOX') {
    return (
      <label className="check-line">
        <input name={name} required={field.required} type="checkbox" value="yes" />
        {label}
      </label>
    );
  }

  return <label>{label}<input name={name} required={field.required} /></label>;
}

function FormManagementView({
  activeForm,
  busy,
  entryFields,
  onCreateField,
  onDeleteField,
  onPrompt,
  onUpdateField,
  onUpdateEntryField,
}: {
  activeForm: ActiveForm | null;
  busy: boolean;
  entryFields: EntryFieldConfig[];
  onCreateField: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  onDeleteField: (field: CustomField) => Promise<void> | void;
  onPrompt: (options: ThemedPromptOptions) => Promise<string | null>;
  onUpdateField: (field: CustomField, patch: Partial<CustomField>) => Promise<void> | void;
  onUpdateEntryField: (key: EntryFieldKey, patch: Partial<EntryFieldConfig>) => void;
}) {
  const fields = [...(activeForm?.customFields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const standardFields = entryFields.filter((field) => field.visible);
  const questionRows = [
    ...standardFields.map((field) => ({ field, kind: 'standard' as const })),
    ...fields.map((field) => ({ field, kind: 'custom' as const })),
  ];
  const pageSize = 5;
  const [questionPage, setQuestionPage] = useState(1);
  const questionPageCount = Math.max(1, Math.ceil(questionRows.length / pageSize));
  const visibleQuestionRows = questionRows.slice((questionPage - 1) * pageSize, questionPage * pageSize);

  useEffect(() => {
    setQuestionPage((current) => Math.min(current, questionPageCount));
  }, [questionPageCount]);

  return (
    <section className="adhyaksh-page">
      <div className="wide-card action-card">
        <div>
          <h2>Vargani Form Management</h2>
          <span>Configure extra questions shown while creating a vargani entry. Use these fields for details that change mandal to mandal.</span>
        </div>
      </div>

      <div className="form-management-grid">
        <form className="form-management-card add-question-card" onSubmit={onCreateField}>
          <div>
            <h3>Add Custom Question</h3>
            <p>Add fields like donor type, building / lane, receipt note, sponsor category, or booth area. These can also be placed on the slip template.</p>
          </div>
          <div className="question-form-grid">
          <label>Question Label<input name="label" placeholder="e.g. Donor Type" required /></label>
          <label>
            Type
            <select name="type" defaultValue="TEXT">
              <option value="TEXT">Text</option>
              <option value="LONG_TEXT">Long Text</option>
              <option value="NUMBER">Number</option>
              <option value="DATE">Date</option>
              <option value="DROPDOWN">Dropdown</option>
              <option value="CHECKBOX">Checkbox</option>
            </select>
          </label>
          <label className="full">Dropdown Options<input name="options" placeholder="Family, Shop, Sponsor" /></label>
          </div>
          <div className="form-switches">
            <label><input name="required" type="checkbox" /><span><strong>Compulsory</strong><small>User must answer this while creating entry.</small></span></label>
            <label><input name="printOnSlip" type="checkbox" /><span><strong>Print on slip</strong><small>Make this field available for receipt template.</small></span></label>
            <label><input name="dashboardFilter" type="checkbox" /><span><strong>Use in filters</strong><small>Useful for reports by area/type later.</small></span></label>
          </div>
          <button className="blue-action" disabled={busy || !activeForm} type="submit"><Plus size={18} />Add Question</button>
        </form>

        <div className="form-management-card current-questions-card">
          <div>
            <h3>Current Form Questions</h3>
            <p>Review every question used in New Vargani Entry. Standard and custom fields are managed together in one clear list.</p>
          </div>
          <div className="managed-fields-table">
            <div className="managed-fields-head question-fields-head">
              <span>Question shown on form</span>
              <span>Type</span>
              <span>Required</span>
              <span>Actions</span>
            </div>
            {questionRows.length === 0 && <EmptyTableState message="No form questions are available yet." />}
            {visibleQuestionRows.map((row) => {
              if (row.kind === 'standard') {
                const field = row.field;
                return (
                  <div className="managed-fields-row question-display-row" key={`standard-${field.key}`}>
                    <span className="managed-question-label" data-label="Question">
                      <span>{field.label}</span>
                      <small className="question-source standard">Standard</small>
                    </span>
                    <span data-label="Type">{field.type.replace('_', ' ')}</span>
                    <strong data-label="Required"><span className={`required-status ${field.required ? 'yes' : 'no'}`}>{field.required ? 'Yes' : 'No'}</span></strong>
                    <span className="row-actions managed-field-actions">
                      <button onClick={async () => {
                          const nextLabel = (await onPrompt({
                            defaultValue: field.label,
                            placeholder: 'Enter question label',
                            title: 'Edit question label',
                          }))?.trim();
                          if (nextLabel && nextLabel !== field.label) onUpdateEntryField(field.key, { label: nextLabel });
                        }} type="button">
                        <Edit3 size={16} />Edit
                      </button>
                      <button
                        disabled={field.locked}
                        onClick={() => onUpdateEntryField(field.key, { required: !field.required })}
                        title={field.locked ? 'Required for receipt generation' : undefined}
                        type="button"
                      >
                        {field.locked ? 'Receipt required' : field.required ? 'Make optional' : 'Make required'}
                      </button>
                      <button
                        className="danger"
                        disabled={field.locked}
                        onClick={() => onUpdateEntryField(field.key, { visible: false })}
                        title={field.locked ? 'This field is required for receipt generation' : undefined}
                        type="button"
                      >
                        <Trash2 size={16} />{field.locked ? 'Protected' : 'Remove'}
                      </button>
                    </span>
                  </div>
                );
              }

              const field = row.field;
              return (
                <div className="managed-fields-row question-display-row" key={`custom-${field.id}`}>
                  <span className="managed-question-label" data-label="Question">
                    <span>{field.label}</span>
                    <small className="question-source custom">Custom</small>
                  </span>
                  <span data-label="Type">{field.type.replace('_', ' ')}</span>
                  <strong data-label="Required"><span className={`required-status ${field.required ? 'yes' : 'no'}`}>{field.required ? 'Yes' : 'No'}</span></strong>
                  <span className="row-actions managed-field-actions">
                    <button onClick={async () => {
                        const nextLabel = (await onPrompt({
                          defaultValue: field.label,
                          placeholder: 'Enter question label',
                          title: 'Edit question label',
                        }))?.trim();
                        if (nextLabel && nextLabel !== field.label) void onUpdateField(field, { label: nextLabel });
                      }} type="button">
                      <Edit3 size={16} />Edit
                    </button>
                    <button
                      onClick={() => void onUpdateField(field, { required: !field.required })}
                      type="button"
                    >
                      {field.required ? 'Make optional' : 'Make required'}
                    </button>
                    <button onClick={() => void onUpdateField(field, { printOnSlip: !field.printOnSlip })} type="button">
                      {field.printOnSlip ? 'Hide from template' : 'Allow on template'}
                    </button>
                    <button className="danger" onClick={() => void onDeleteField(field)} type="button"><Trash2 size={16} />Delete</button>
                  </span>
                </div>
              );
            })}
          </div>
          <Pagination
            onPageChange={setQuestionPage}
            page={questionPage}
            pageSize={pageSize}
            totalItems={questionRows.length}
            totalPages={questionPageCount}
          />
        </div>
      </div>
    </section>
  );
}

function Pagination({
  onPageChange,
  page,
  pageSize,
  totalItems,
  totalPages,
}: {
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}) {
  if (totalItems === 0) return null;

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);
  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((pageNumber) => totalPages <= 5 || pageNumber === 1 || pageNumber === totalPages || Math.abs(pageNumber - page) <= 1);

  return (
    <nav aria-label="Form questions pagination" className="table-pagination">
      <p>Showing <strong>{firstItem}–{lastItem}</strong> of <strong>{totalItems}</strong> questions</p>
      <div className="pagination-controls">
        <button aria-label="Previous page" disabled={page === 1} onClick={() => onPageChange(page - 1)} type="button">
          <ChevronLeft size={17} />
          <span>Previous</span>
        </button>
        <div className="pagination-pages">
          {visiblePages.map((pageNumber, index) => {
            const previousPage = visiblePages[index - 1];
            return (
              <span className="pagination-page-slot" key={pageNumber}>
                {previousPage && pageNumber - previousPage > 1 && <span aria-hidden="true" className="pagination-ellipsis">…</span>}
                <button
                  aria-current={pageNumber === page ? 'page' : undefined}
                  aria-label={`Page ${pageNumber}`}
                  className={pageNumber === page ? 'active' : ''}
                  onClick={() => onPageChange(pageNumber)}
                  type="button"
                >
                  {pageNumber}
                </button>
              </span>
            );
          })}
        </div>
        <button aria-label="Next page" disabled={page === totalPages} onClick={() => onPageChange(page + 1)} type="button">
          <span>Next</span>
          <ChevronRight size={17} />
        </button>
      </div>
    </nav>
  );
}

function AdminTopbar({
  language,
  onLanguageChange,
  session,
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
  session: AuthSession;
}) {
  return (
    <div className="app-topbar">
      <strong>{t(language, 'Digital Vargani')}</strong>
      <div className="top-search">
        <Search size={18} />
        <span>{t(language, 'Search')}</span>
        <kbd>Ctrl K</kbd>
      </div>
      <label className="language-picker">
        <select value={language} onChange={(event) => onLanguageChange(event.target.value as Language)}>
          <option value="en">{t(language, 'English')}</option>
          <option value="mr">{t(language, 'Marathi')}</option>
          <option value="hi">{t(language, 'Hindi')}</option>
        </select>
      </label>
      <div className="top-user">
        <span>{session.user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
        <div>
          <strong>{session.user.name}</strong>
          <small>{session.user.role.replaceAll('_', ' ')}</small>
        </div>
      </div>
    </div>
  );
}

function SuperAdminApp({
  busy,
  demoMandals,
  language,
  notice,
  onArchiveMandal,
  onArchivePartner,
  onCreateMandal,
  onCreatePartner,
  onLanguageChange,
  onLogout,
  onMandalLoginCreated,
  onPreviewChange,
  onPrompt,
  onTemplateSaved,
  onUpdateMandal,
  onUpdateMandalLogin,
  onUpdatePartner,
  partners,
  session,
  setSidebarOpen,
  sidebarOpen,
}: {
  busy: boolean;
  demoMandals: DemoMandal[];
  language: Language;
  notice: string;
  onArchiveMandal: (mandal: DemoMandal) => Promise<boolean>;
  onArchivePartner: (partner: Partner) => Promise<boolean>;
  onCreateMandal: (event: FormEvent<HTMLFormElement>) => Promise<{ id?: string; ok: boolean }>;
  onCreatePartner: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  onLanguageChange: (language: Language) => void;
  onLogout: () => void;
  onMandalLoginCreated: (mandalId: string, user: MandalLoginUser) => void;
  onPreviewChange: (url: string) => void;
  onPrompt: (options: ThemedPromptOptions) => Promise<string | null>;
  onTemplateSaved: (
    placements: Record<string, TemplatePlacement>,
    target?: { festivalId?: string; mandalId?: string; previewUrl?: string },
  ) => Promise<void> | void;
  onUpdateMandal: (mandalId: string, patch: Record<string, unknown>) => Promise<DemoMandal | null>;
  onUpdateMandalLogin: (mandalId: string, userId: string, patch: Record<string, unknown>) => Promise<MandalLoginUser | null>;
  onUpdatePartner: (partnerId: string, patch: Record<string, unknown>) => Promise<Partner | null>;
  partners: Partner[];
  session: AuthSession;
  setSidebarOpen: (open: boolean | ((current: boolean) => boolean)) => void;
  sidebarOpen: boolean;
}) {
  const mandals = demoMandals;
  const [ownerScreen, setOwnerScreen] = useState<OwnerScreen>(() => parseOwnerRoute()?.screen ?? 'dashboard');
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const route = parseOwnerRoute();
    if (!route?.mandalId) return 0;
    const routeIndex = mandals.findIndex((mandal) => mandal.id === route.mandalId);
    return routeIndex >= 0 ? routeIndex : 0;
  });
  const [detailTab, setDetailTab] = useState<OwnerMandalTab>(() => parseOwnerRoute()?.tab ?? 'overview');
  const [addMandalOpen, setAddMandalOpen] = useState(false);
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [managedIndex, setManagedIndex] = useState<number | null>(null);
  const [ownerQuery, setOwnerQuery] = useState('');
  const deferredOwnerQuery = useDeferredValue(ownerQuery);
  const [partnerQuery, setPartnerQuery] = useState('');
  const deferredPartnerQuery = useDeferredValue(partnerQuery);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');
  const [editingLogin, setEditingLogin] = useState<MandalLoginUser | null>(null);
  const [mandalEditBusy, setMandalEditBusy] = useState(false);
  const [authkeyTemplates, setAuthkeyTemplates] = useState<AuthkeyWhatsAppTemplate[]>([]);
  const [authkeyTemplatesError, setAuthkeyTemplatesError] = useState('');
  const [authkeyTemplatesLoading, setAuthkeyTemplatesLoading] = useState(false);
  const [authkeyDefaultTemplateWid, setAuthkeyDefaultTemplateWid] = useState<string | null>(null);
  const [whatsappTemplateWid, setWhatsappTemplateWid] = useState('');
  const [mandalLogins, setMandalLogins] = useState<Record<string, Array<{ name?: string; password: string; role: string; userId?: string; username: string }>>>({});
  const [ownerTemplateDrafts, setOwnerTemplateDrafts] = useState<Record<string, string>>({});
  const selectedMandal = mandals[Math.min(selectedIndex, mandals.length - 1)];
  const selectedPartner = partners.find((partner) => partner.id === selectedPartnerId) ?? partners[0] ?? null;
  const selectedKey = selectedMandal?.id ?? selectedMandal?.name ?? '';
  const extraLogins = mandalLogins[selectedKey] ?? [];
  const selectedTemplateVersion = selectedMandal?.festivals?.[0]?.templates?.[0]?.versions?.[0];
  const selectedTemplatePreview = resolveTemplateAssetUrl(
    (selectedKey && ownerTemplateDrafts[selectedKey]) || selectedTemplateVersion?.backgroundFileUrl || TEMPLATE_IMAGE,
  );
  const selectedAuthkeyTemplate = authkeyTemplates.find((template) => template.wid === whatsappTemplateWid);
  const defaultAuthkeyTemplate = authkeyTemplates.find((template) => template.wid === authkeyDefaultTemplateWid);
  const activeUsers = selectedMandal?.users?.filter((user) => user.status === 'ACTIVE') ?? [];
  const adminUser = activeUsers.find((user) => user.role === 'MANDAL_ADMIN');
  const persistedLogins =
    activeUsers
      .filter((user) => user.role !== 'MANDAL_ADMIN')
      .map((user) => ({
        name: user.name,
        password: 'Stored securely in backend',
        role: user.role.replaceAll('_', ' '),
        userId: user.id,
        username: user.email || user.phone || user.name,
      }));
  const ownerLoginRows = [
    {
      password: selectedMandal?.adminPassword || 'Stored securely in backend',
      role: 'Adhyaksh',
      userId: adminUser?.id,
      username: selectedMandal?.adminEmail || adminUser?.email || adminUser?.phone || (selectedMandal ? `admin@${slugify(selectedMandal.name)}.local` : ''),
    },
    ...extraLogins,
    ...persistedLogins.filter((login) => !extraLogins.some((extra) => extra.username === login.username)),
  ];
  const { filteredMandals, totalMembers, totalSlipsGenerated } = useMemo(() => {
    const normalizedQuery = deferredOwnerQuery.trim().toLowerCase();
    return {
      filteredMandals: mandals
        .map((mandal, index) => ({ index, mandal }))
        .filter(({ mandal }) => !normalizedQuery || [
          mandal.name,
          mandal.address,
          mandal.locality,
          mandal.city,
          mandal.contactEmail,
          mandal.partner?.name,
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery))),
      totalMembers: mandals.reduce(
        (sum, mandal) => sum + Number(mandal._count?.members ?? mandal.memberCount ?? 0),
        0,
      ),
      totalSlipsGenerated: mandals.reduce(
        (sum, mandal) => sum + Number(mandal._count?.slips ?? 0),
        0,
      ),
    };
  }, [deferredOwnerQuery, mandals]);
  const { attributedMandals, filteredPartners, partnerMandals } = useMemo(() => {
    const normalizedQuery = deferredPartnerQuery.trim().toLowerCase();
    return {
      attributedMandals: mandals.filter((mandal) => mandal.partnerId).length,
      filteredPartners: partners.filter((partner) => !normalizedQuery || [
        partner.name,
        partner.email,
        partner.phone,
        partner.address,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery))),
      partnerMandals: selectedPartner
        ? mandals.filter((mandal) => mandal.partnerId === selectedPartner.id)
        : [],
    };
  }, [deferredPartnerQuery, mandals, partners, selectedPartner]);

  useEffect(() => {
    if (!partners.length) {
      setSelectedPartnerId('');
      return;
    }
    if (!selectedPartnerId || !partners.some((partner) => partner.id === selectedPartnerId)) {
      setSelectedPartnerId(partners[0].id);
    }
  }, [partners, selectedPartnerId]);

  const loadAuthkeyTemplates = useCallback(async (forceRefresh = false) => {
    setAuthkeyTemplatesLoading(true);
    setAuthkeyTemplatesError('');
    try {
      const catalog = await apiRequest<AuthkeyWhatsAppTemplateCatalog>(
        `/mandals/whatsapp/templates${forceRefresh ? '?refresh=true' : ''}`,
        {},
        session,
      );
      setAuthkeyTemplates(catalog.items);
      setAuthkeyDefaultTemplateWid(catalog.defaultWid);
    } catch (error) {
      setAuthkeyTemplatesError(error instanceof Error ? error.message : 'Could not load Authkey templates.');
    } finally {
      setAuthkeyTemplatesLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void loadAuthkeyTemplates(false);
  }, [loadAuthkeyTemplates]);

  useEffect(() => {
    setWhatsappTemplateWid(selectedMandal?.whatsappTemplateWid ?? '');
  }, [selectedMandal?.id, selectedMandal?.whatsappTemplateWid]);

  function syncOwnerRoute() {
    const route = parseOwnerRoute();
    if (!route) return;
    setOwnerScreen(route.screen);
    setDetailTab(route.tab);
    setSidebarOpen(false);

    if (route.isNew) {
      setManagedIndex(null);
      setAddMandalOpen(true);
      return;
    }

    setAddMandalOpen(false);

    if (route.screen !== 'mandals' || !route.mandalId) {
      setManagedIndex(null);
      setAddPartnerOpen(false);
      return;
    }

    const routeIndex = mandals.findIndex((mandal) => mandal.id === route.mandalId);
    if (routeIndex >= 0) {
      setSelectedIndex(routeIndex);
      setManagedIndex(routeIndex);
    }
  }

  useEffect(() => {
    const route = parseOwnerRoute();
    if (!route) {
      writeRoute(routeForOwner(ownerScreen, managedIndex !== null ? selectedMandal?.id : null, detailTab), 'replace');
    } else {
      syncOwnerRoute();
    }

    window.addEventListener('hashchange', syncOwnerRoute);
    window.addEventListener('popstate', syncOwnerRoute);
    return () => {
      window.removeEventListener('hashchange', syncOwnerRoute);
      window.removeEventListener('popstate', syncOwnerRoute);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [mandals.length]);

  function openOwnerScreen(screen: OwnerScreen) {
    setOwnerScreen(screen);
    setManagedIndex(null);
    setAddMandalOpen(false);
    setAddPartnerOpen(false);
    writeRoute(routeForOwner(screen));
    setSidebarOpen(false);
  }

  function openAddMandal() {
    setOwnerScreen('mandals');
    setManagedIndex(null);
    setAddMandalOpen(true);
    setAddPartnerOpen(false);
    writeRoute(routeForNewMandal());
    setSidebarOpen(false);
  }

  function openAddPartner() {
    setOwnerScreen('partners');
    setManagedIndex(null);
    setAddMandalOpen(false);
    setAddPartnerOpen(true);
    writeRoute(routeForOwner('partners'));
    setSidebarOpen(false);
  }

  function openMandal(index: number) {
    const mandal = mandals[index];
    setSelectedIndex(index);
    setManagedIndex(index);
    setOwnerScreen('mandals');
    setDetailTab('overview');
    setAddMandalOpen(false);
    setAddPartnerOpen(false);
    writeRoute(routeForOwner('mandals', mandal?.id, 'overview'));
    setSidebarOpen(false);
  }

  async function deleteMandal(index: number) {
    const mandal = mandals[index];
    if (!mandal) return;
    const deleted = await onArchiveMandal(mandal);
    if (!deleted) return;
    setManagedIndex(null);
    setSelectedIndex(0);
    setOwnerScreen('mandals');
    setAddMandalOpen(false);
    writeRoute(routeForOwner('mandals'));
    setSidebarOpen(false);
  }

  function openMandalTab(tab: OwnerMandalTab) {
    setDetailTab(tab);
    writeRoute(routeForOwner('mandals', selectedMandal?.id, tab));
  }

  function handleOwnerTemplatePreviewChange(url: string) {
    const resolvedUrl = resolveTemplateAssetUrl(url);
    if (!selectedKey) {
      onPreviewChange(resolvedUrl);
      return;
    }
    setOwnerTemplateDrafts((current) => ({ ...current, [selectedKey]: resolvedUrl }));
    onPreviewChange(resolvedUrl);
  }

  async function addOwnerTemplateField(label: string, required = true) {
    const mandalId = selectedMandal?.id;
    const festivalId = selectedMandal?.festivals?.[0]?.id;
    const trimmedLabel = label.trim();
    if (!mandalId || !festivalId || !trimmedLabel) {
      throw new Error('Open a Mandal with an active festival before adding a custom field.');
    }
    return apiRequest<CustomField>(
      `/mandals/${mandalId}/festivals/${festivalId}/custom-fields`,
      {
        body: JSON.stringify({
          label: trimmedLabel,
          printOnSlip: true,
          required,
          type: 'TEXT',
        }),
        method: 'POST',
      },
      session,
    );
  }

  async function createLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMandal?.id) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const username = String(form.get('username') || '').trim();
    const normalizedPhone = username.includes('@') ? '' : normalizeOptionalIndianPhone(username);
    if (!username.includes('@') && !normalizedPhone) {
      setLoginMessage('Enter a valid email or Indian mobile number.');
      setFormFieldError(formElement, 'username', 'Enter a valid email or Indian mobile number.');
      return;
    }
    const nextLogin = {
      password: String(form.get('password') || generateTemporaryPassword()),
      role: String(form.get('role') || 'Khajindar'),
      username: username.includes('@') ? username : normalizedPhone,
    };
    const roleMap: Record<string, UserRole> = {
      'Group Leader': 'GROUP_LEADER',
      Khajindar: 'KHAJINDAR',
      Karyakari: 'GROUP_LEADER',
      Member: 'MEMBER',
    };
    setLoginBusy(true);
    setLoginMessage('Creating login...');
    try {
      const createdUser = await apiRequest<MandalLoginUser>(
        `/mandals/${selectedMandal.id}/users`,
        {
          body: JSON.stringify({
            email: nextLogin.username.includes('@') ? nextLogin.username : undefined,
            name: String(form.get('name') || nextLogin.role),
            password: nextLogin.password,
            phone: nextLogin.username.includes('@') ? undefined : nextLogin.username,
            role: roleMap[nextLogin.role] ?? 'MEMBER',
          }),
          method: 'POST',
        },
        session,
      );
      onMandalLoginCreated(selectedMandal.id, createdUser);
      setMandalLogins((current) => ({
        ...current,
        [selectedKey]: [
          {
            name: createdUser.name,
            password: nextLogin.password,
            role: createdUser.role.replaceAll('_', ' '),
            userId: createdUser.id,
            username: createdUser.email || createdUser.phone || nextLogin.username,
          },
          ...(current[selectedKey] ?? []),
        ],
      }));
      formElement.reset();
      setLoginMessage('Login created. Copy it before leaving this screen.');
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : 'Could not create login.');
      focusFormErrorFromMessage(formElement, error);
    } finally {
      setLoginBusy(false);
    }
  }

  async function saveMandalDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMandal?.id) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const rawPhone = String(form.get('contactPhone') || '').trim();
    const contactPhone = normalizeOptionalIndianPhone(rawPhone);
    if (rawPhone && !contactPhone) {
      setLoginMessage('Enter a valid 10-digit Indian contact number.');
      setFormFieldError(formElement, 'contactPhone', 'Enter a valid 10-digit Indian contact number.');
      return;
    }
    const logo = form.get('logo');
    setMandalEditBusy(true);
    try {
      const logoDataUrl = logo instanceof File && logo.size > 0
        ? await imageFileToCompressedDataUrl(logo)
        : undefined;
      const updated = await onUpdateMandal(selectedMandal.id, {
        address: String(form.get('address') || '').trim() || null,
        city: String(form.get('city') || '').trim() || null,
        contactName: String(form.get('contactName') || '').trim() || null,
        contactPhone: contactPhone || null,
        locality: String(form.get('locality') || '').trim() || null,
        logoDataUrl,
        name: String(form.get('name') || '').trim(),
        nameMr: String(form.get('nameMr') || '').trim() || null,
        partnerId: String(form.get('partnerId') || '') || null,
        plan: String(form.get('plan') || 'starter'),
        slipLimit: Number(form.get('slipLimit') || 0) || null,
        state: String(form.get('state') || '').trim() || null,
        whatsappMode: String(form.get('whatsappMode') || 'AUTO_API'),
        whatsappTemplateWid: whatsappTemplateWid || null,
      });
      setLoginMessage(updated ? 'Mandal profile saved.' : 'Could not save Mandal profile.');
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : 'Could not save Mandal profile.');
      focusFormErrorFromMessage(formElement, error);
    } finally {
      setMandalEditBusy(false);
    }
  }

  async function saveEditedLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMandal?.id || !editingLogin) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const rawPhone = String(form.get('phone') || '').trim();
    const phone = normalizeOptionalIndianPhone(rawPhone);
    const password = String(form.get('password') || '');
    if (!email && !phone) {
      setLoginMessage('Enter an email username or mobile number.');
      setFormFieldError(formElement, email ? 'phone' : 'email', 'Enter an email username or mobile number.');
      return;
    }
    if (rawPhone && !phone) {
      setLoginMessage('Enter a valid 10-digit Indian mobile number.');
      setFormFieldError(formElement, 'phone', 'Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (password && password.length < 8) {
      setLoginMessage('New password must contain at least 8 characters.');
      setFormFieldError(formElement, 'password', 'New password must contain at least 8 characters.');
      return;
    }

    setLoginBusy(true);
    const updated = await onUpdateMandalLogin(selectedMandal.id, editingLogin.id, {
      email: email || undefined,
      name: String(form.get('name') || '').trim(),
      password: password || undefined,
      phone: phone || undefined,
      role: editingLogin.role === 'MANDAL_ADMIN' ? 'MANDAL_ADMIN' : String(form.get('role') || editingLogin.role),
    });
    setLoginBusy(false);
    if (updated) {
      setEditingLogin(null);
      setLoginMessage('Login username and password updated.');
    }
  }

  async function saveEditedPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPartner) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const rawPhone = String(form.get('phone') || '').trim();
    const phone = normalizeOptionalIndianPhone(rawPhone);
    if (rawPhone && !phone) {
      setLoginMessage('Enter a valid 10-digit Indian partner mobile number.');
      setFormFieldError(formElement, 'phone', 'Enter a valid 10-digit Indian partner mobile number.');
      return;
    }

    setLoginBusy(true);
    const updated = await onUpdatePartner(editingPartner.id, {
      address: String(form.get('address') || '').trim() || null,
      email: String(form.get('email') || '').trim().toLowerCase() || null,
      name: String(form.get('name') || '').trim(),
      phone: phone || null,
    });
    setLoginBusy(false);
    if (updated) {
      setEditingPartner(null);
      setSelectedPartnerId(updated.id);
    }
  }

  async function copyLogin(login: { password: string; role: string; username: string }) {
    const text = `Login URL: ${mandalLoginUrl()}\nRole: ${login.role}\nUsername: ${login.username}\nPassword: ${login.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setLoginMessage('Login copied.');
    } catch {
      await onPrompt({
        confirmLabel: 'Done',
        defaultValue: text,
        message: 'Clipboard access is blocked. Select and copy these login details.',
        multiline: true,
        title: 'Copy login details',
      });
    }
  }

  return (
    <>
    <main className={`shell owner-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <button className="mobile-menu-toggle" onClick={() => setSidebarOpen((open) => !open)} type="button">
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      {sidebarOpen && <button aria-label="Close menu" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} type="button" />}
      <aside className="sidebar">
        <div className="brand">
          <span>DV</span>
          <div>
            <strong>{t(language, 'Digital Vargani')}</strong>
            <small>{t(language, 'Super Admin Console')}</small>
          </div>
        </div>
        <nav>
          <button className={ownerScreen === 'dashboard' ? 'active' : ''} onClick={() => openOwnerScreen('dashboard')} type="button">
            <LayoutDashboard size={19} />{t(language, 'Dashboard')}
          </button>
          <button className={ownerScreen === 'mandals' ? 'active' : ''} onClick={() => openOwnerScreen('mandals')} type="button">
            <Building2 size={19} />{t(language, 'Mandals')}
          </button>
          <button className={ownerScreen === 'partners' ? 'active' : ''} onClick={() => openOwnerScreen('partners')} type="button">
            <UsersRound size={19} />Partners
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <span>O</span>
            <div>
              <strong>{session.user.name}</strong>
              <small>SUPER ADMIN</small>
            </div>
          </div>
          <button className="logout" onClick={() => { setSidebarOpen(false); onLogout(); }} type="button"><LogOut size={18} />{t(language, 'Logout')}</button>
        </div>
      </aside>

      <section className="content">
        <AdminTopbar language={language} onLanguageChange={onLanguageChange} session={session} />
        <header className="page-header">
          <div>
            <h1>{ownerScreen === 'dashboard' ? t(language, 'Dashboard') : ownerScreen === 'partners' ? 'Partners' : t(language, 'Mandals')}</h1>
            <p>{ownerScreen === 'dashboard'
              ? 'Track all onboarded mandals and software operations.'
              : ownerScreen === 'partners'
                ? 'Track who brought each mandal into ePawati.'
                : t(language, 'Add mandals and manage each client account.')}</p>
          </div>
          <div className="header-actions">
            {ownerScreen === 'partners' && <button onClick={openAddPartner} type="button"><Plus size={18} />Add Partner</button>}
            <button onClick={openAddMandal} type="button"><Plus size={18} />{t(language, 'Add Mandal')}</button>
          </div>
        </header>
        <div className="notice">{notice}</div>

        {ownerScreen === 'dashboard' && (
          <>
            <section className="stats-grid compact owner-stat-grid">
              <Stat icon={<Building2 />} label={t(language, 'Total Mandals')} note="Onboarded client mandals" value={String(mandals.length)} />
              <Stat icon={<UsersRound />} label="Partners" note={`${attributedMandals} attributed mandals`} value={String(partners.length)} />
              <Stat icon={<UsersRound />} label={t(language, 'Total Members')} note="Across all mandals" value={String(totalMembers)} />
              <Stat icon={<FileText />} label={t(language, 'Slips Generated')} note="Live receipt records" value={String(totalSlipsGenerated)} />
            </section>
            <section className="owner-list-head">
              <div>
                <h2>{t(language, 'Mandals')}</h2>
                <p>Each block represents one mandal. Open Manage to set logins and templates.</p>
              </div>
              <button className="primary" onClick={openAddMandal} type="button"><Plus size={18} />{t(language, 'Add Mandal')}</button>
            </section>
            <section className="owner-toolbar">
              <div className="search-input">
                <Search size={20} />
                <input onChange={(event) => setOwnerQuery(event.target.value)} placeholder={t(language, 'Search mandals by name, area, email...')} value={ownerQuery} />
              </div>
              <span>{filteredMandals.length} of {mandals.length} mandals</span>
            </section>
            <MandalCardGrid items={filteredMandals} onDelete={deleteMandal} onManage={openMandal} />
          </>
        )}

        {ownerScreen === 'mandals' && managedIndex === null && (
          <>
            <section className="stats-grid compact owner-stat-grid">
              <Stat icon={<Building2 />} label={t(language, 'Total Mandals')} note="Onboarded" value={String(mandals.length)} />
              <Stat icon={<UsersRound />} label="Partners" note="Business developers" value={String(partners.length)} />
              <Stat icon={<UsersRound />} label={t(language, 'Total Members')} note="Declared collectors" value={String(totalMembers)} />
              <Stat icon={<ReceiptText />} label={t(language, 'Slips Generated')} note="Across mandals" value={String(totalSlipsGenerated)} />
            </section>
            {addMandalOpen && (
              <form
                className="card form-grid owner-add-panel"
                onSubmit={async (event) => {
                  const created = await onCreateMandal(event);
                  if (!created.ok) return;
                  setAddMandalOpen(false);
                  if (created.id) {
                    setOwnerScreen('mandals');
                    setManagedIndex(null);
                    writeRoute(routeForOwner('mandals', created.id, 'overview'));
                  } else {
                    writeRoute(routeForOwner('mandals'));
                  }
                }}
              >
                <div className="panel-title full">
                  <Plus size={22} />
                  <div>
                    <strong>{t(language, 'Add Mandal')}</strong>
                    <span>{t(language, 'Mandal name is required. Address, logo, contacts and member count are optional.')}</span>
                  </div>
                  <button className="ghost-button" onClick={() => { setAddMandalOpen(false); writeRoute(routeForOwner('mandals')); }} type="button">Close</button>
                </div>
                <label className="full">Mandal Name *<input name="name" required placeholder="Ganesh Mitra Mandal" /></label>
                <label>{t(language, 'Address')}<input name="address" placeholder="Full mandal address" /></label>
                <label>Locality<input name="locality" placeholder="Main Road, Pune" /></label>
                <label>City<input name="city" defaultValue="Pune" /></label>
                <label>{t(language, 'Phone No.')}<input name="contactPhone" placeholder="+919876543210" /></label>
                <label>Contact Email<input name="contactEmail" placeholder="contact@mandal.local" /></label>
                <label>No. of Members<input name="memberCount" inputMode="numeric" placeholder="50" /></label>
                <label>Slip Generation Limit *<input inputMode="numeric" min={1} name="slipLimit" required placeholder="e.g. 1000" type="number" /></label>
                <label>Registered By<select defaultValue="" name="partnerId"><option value="">No partner</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label>
                <label>WhatsApp Delivery<select defaultValue="AUTO_API" name="whatsappMode"><option value="AUTO_API">Automatic — Paid API</option><option value="MANUAL_SHARE">Manual — Open WhatsApp App</option></select></label>
                <label>Adhyaksh Name<input name="adhyakshName" placeholder="Main admin name" /></label>
                <label>Adhyaksh Email *<input name="adminEmail" required placeholder="admin@mandal.local" /></label>
                <label className="full">Adhyaksh Password *<input autoComplete="new-password" minLength={12} name="adminPassword" required type="password" placeholder="Minimum 12 characters" /></label>
                <label className="full">Mandal Logo<input accept="image/*" name="logo" type="file" /></label>
                <button className="primary full" disabled={busy} type="submit"><Plus size={18} />{busy ? 'Creating Mandal...' : t(language, 'Add Mandal')}</button>
              </form>
            )}
            <section className="owner-toolbar">
              <div className="search-input">
                <Search size={20} />
                <input onChange={(event) => setOwnerQuery(event.target.value)} placeholder={t(language, 'Search mandals by name, area, email...')} value={ownerQuery} />
              </div>
              <span>{filteredMandals.length} of {mandals.length} mandals</span>
            </section>
            <MandalCardGrid items={filteredMandals} onDelete={deleteMandal} onManage={openMandal} />
          </>
        )}

        {ownerScreen === 'partners' && (
          <>
            <section className="stats-grid compact owner-stat-grid">
              <Stat icon={<UsersRound />} label="Total Partners" note="Active business partners" value={String(partners.length)} />
              <Stat icon={<Building2 />} label="Attributed Mandals" note="Partner-linked clients" value={String(attributedMandals)} />
              <Stat icon={<ReceiptText />} label="Unassigned Mandals" note="No partner selected" value={String(Math.max(0, mandals.length - attributedMandals))} />
            </section>
            {addPartnerOpen && (
              <form className="card form-grid owner-add-panel" onSubmit={async (event) => {
                const ok = await onCreatePartner(event);
                if (ok) setAddPartnerOpen(false);
              }}>
                <div className="panel-title full">
                  <Plus size={22} />
                  <div>
                    <strong>Add Partner</strong>
                    <span>Create the person who helped register mandals.</span>
                  </div>
                  <button className="ghost-button" onClick={() => setAddPartnerOpen(false)} type="button">Close</button>
                </div>
                <label>Partner Name *<input name="name" required placeholder="Darshan Choudhari" /></label>
                <label>Email<input name="email" placeholder="darshan@example.com" type="email" /></label>
                <label>Mobile<input inputMode="tel" name="phone" placeholder="+919876543210" /></label>
                <label className="full">Address<input name="address" placeholder="Partner address" /></label>
                <button className="primary full" disabled={busy} type="submit"><Plus size={18} />Add Partner</button>
              </form>
            )}
            <section className="owner-list-head">
              <div>
                <h2>Partners</h2>
                <p>Select a partner to see the mandals registered through them.</p>
              </div>
              <button className="primary" onClick={openAddPartner} type="button"><Plus size={18} />Add Partner</button>
            </section>
            <section className="owner-toolbar">
              <div className="search-input">
                <Search size={20} />
                <input onChange={(event) => setPartnerQuery(event.target.value)} placeholder="Search partners by name, email, mobile..." value={partnerQuery} />
              </div>
              <span>{filteredPartners.length} of {partners.length} partners</span>
            </section>
            <section className="partner-page-grid">
              <div className="partner-list">
                {filteredPartners.map((partner) => (
                  <article className={`partner-card ${selectedPartner?.id === partner.id ? 'active' : ''}`} key={partner.id}>
                    <div className="partner-card-main">
                      <span className="avatar small">{partner.name.charAt(0).toUpperCase()}</span>
                      <div>
                        <strong>{partner.name}</strong>
                        <small>{partner.address || 'Address not added'}</small>
                      </div>
                      <em>{mandals.filter((mandal) => mandal.partnerId === partner.id).length} mandals</em>
                    </div>
                    <div className="partner-card-meta">
                      <span>{partner.phone || 'Mobile pending'}</span>
                      <span>{partner.email || 'Email pending'}</span>
                    </div>
                    <div className="partner-card-actions">
                      <button onClick={() => setSelectedPartnerId(partner.id)} type="button"><Eye size={16} />View</button>
                      <button onClick={() => setEditingPartner(partner)} type="button"><Edit3 size={16} />Edit</button>
                      <button className="danger" onClick={() => void onArchivePartner(partner)} type="button"><Trash2 size={16} />Archive</button>
                    </div>
                  </article>
                ))}
                {!filteredPartners.length && (
                  <div className="empty-card">
                    <UsersRound size={34} />
                    <strong>No partners found</strong>
                    <span>Add your first partner, then assign them while creating mandals.</span>
                  </div>
                )}
              </div>
              <div className="partner-detail-card">
                <div className="partner-detail-head">
                  <span className="avatar">{selectedPartner?.name.charAt(0).toUpperCase() ?? 'P'}</span>
                  <div>
                    <strong>{selectedPartner?.name ?? 'Partner detail'}</strong>
                    <span>{selectedPartner ? `${partnerMandals.length} mandals registered` : 'Select a partner from the list.'}</span>
                  </div>
                </div>
                {selectedPartner && (
                  <>
                    <div className="partner-contact-grid">
                      <StatusLine label="Mobile" value={selectedPartner.phone || 'Not added'} />
                      <StatusLine label="Email" value={selectedPartner.email || 'Not added'} />
                      <StatusLine label="Address" value={selectedPartner.address || 'Not added'} />
                    </div>
                    <div className="partner-mandal-list">
                      {partnerMandals.map((mandal) => (
                        <article className="partner-mandal-card" key={mandal.id}>
                          <MandalAvatar mandal={mandal} />
                          <div>
                            <strong>{mandal.name}</strong>
                            <small>{mandal.locality || mandal.city || 'Location not set'}</small>
                          </div>
                          <span>{mandal.contactPhone || 'Phone pending'}</span>
                          <em>{mandal.plan ?? 'starter'}</em>
                          <button onClick={() => {
                            const index = mandals.findIndex((item) => item.id === mandal.id);
                            if (index >= 0) openMandal(index);
                          }} type="button">Manage</button>
                        </article>
                      ))}
                      {!partnerMandals.length && <div className="empty-state">No mandals assigned to this partner yet.</div>}
                    </div>
                  </>
                )}
              </div>
            </section>
          </>
        )}

        {ownerScreen === 'mandals' && managedIndex !== null && selectedMandal && (
          <section className="owner-managed-view">
            <button className="back-link" onClick={() => openOwnerScreen('mandals')} type="button">
              <ArrowLeft size={20} />{t(language, 'Back to Mandals')}
            </button>
            <div className="card owner-detail-card">
              <div className="owner-detail-header">
                <MandalAvatar mandal={selectedMandal} />
                <div>
                  <strong>{selectedMandal.name}</strong>
                  <span>{selectedMandal.address || selectedMandal.locality || 'Address not added'}</span>
                  <span>Registered by {selectedMandal.partner?.name ?? 'No partner selected'}</span>
                </div>
              </div>
              <div className="detail-tabs">
                <button className={detailTab === 'overview' ? 'active' : ''} onClick={() => openMandalTab('overview')} type="button">{t(language, 'Overview')}</button>
                <button className={detailTab === 'template' ? 'active' : ''} onClick={() => openMandalTab('template')} type="button">{t(language, 'Template')}</button>
              </div>

              {detailTab === 'overview' && (
                <section className="owner-overview">
                  <form className="card form-grid mandal-edit-card" onSubmit={saveMandalDetails}>
                    <div className="panel-title full">
                      <Edit3 size={22} />
                      <div>
                        <strong>Edit Mandal Details</strong>
                        <span>Update identity, address, contact information, plan, and logo.</span>
                      </div>
                    </div>
                    <label>Mandal Name<input defaultValue={selectedMandal.name} name="name" required /></label>
                    <label>Marathi Name<input defaultValue={selectedMandal.nameMr ?? ''} name="nameMr" /></label>
                    <label className="full">Address<input defaultValue={selectedMandal.address ?? ''} name="address" /></label>
                    <label>Locality<input defaultValue={selectedMandal.locality ?? ''} name="locality" /></label>
                    <label>City<input defaultValue={selectedMandal.city ?? ''} name="city" /></label>
                    <label>State<input defaultValue={selectedMandal.state ?? 'Maharashtra'} name="state" /></label>
                    <label>Plan<select defaultValue={selectedMandal.plan ?? 'starter'} name="plan"><option value="starter">Starter</option><option value="standard">Standard</option><option value="premium">Premium</option></select></label>
                    <label>Slip Generation Limit<input defaultValue={selectedMandal.slipLimit ?? ''} inputMode="numeric" min={1} name="slipLimit" placeholder="Unlimited when blank" type="number" /></label>
                    <label>Registered By<select defaultValue={selectedMandal.partnerId ?? ''} name="partnerId"><option value="">No partner</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label>
                    <label>WhatsApp Delivery<select defaultValue={selectedMandal.whatsappMode ?? 'AUTO_API'} name="whatsappMode"><option value="AUTO_API">Automatic — Paid API</option><option value="MANUAL_SHARE">Manual — Open WhatsApp App</option></select></label>
                    <div className="full whatsapp-template-setting">
                      <label>
                        Authkey Receipt Template
                        <select
                          disabled={authkeyTemplatesLoading}
                          name="whatsappTemplateWid"
                          onChange={(event) => setWhatsappTemplateWid(event.target.value)}
                          value={whatsappTemplateWid}
                        >
                          <option value="">
                            Live default: {defaultAuthkeyTemplate?.name ?? 'configured template'}
                            {authkeyDefaultTemplateWid ? ` · WID ${authkeyDefaultTemplateWid}` : ''}
                          </option>
                          {authkeyTemplates.map((template) => (
                            <option
                              disabled={!template.approved || !template.compatible}
                              key={template.wid}
                              value={template.wid}
                            >
                              {template.name} · {template.language.toUpperCase()} · WID {template.wid}
                              {!template.approved ? ' · Pending' : !template.compatible ? ' · Unsupported variables' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="ghost-button"
                        disabled={authkeyTemplatesLoading}
                        onClick={() => void loadAuthkeyTemplates(true)}
                        type="button"
                      >
                        <RefreshCw className={authkeyTemplatesLoading ? 'spin-icon' : ''} size={17} />
                        {authkeyTemplatesLoading ? 'Syncing...' : 'Sync Authkey'}
                      </button>
                      <span className={authkeyTemplatesError ? 'template-sync-error' : 'template-sync-help'}>
                        {authkeyTemplatesError || (selectedAuthkeyTemplate
                          ? `${selectedAuthkeyTemplate.category} · ${selectedAuthkeyTemplate.variableCount} mapped variable${selectedAuthkeyTemplate.variableCount === 1 ? '' : 's'} · Approved`
                          : 'The current live default applies to this mandal until a specific approved template is selected.')}
                      </span>
                    </div>
                    <label>Contact / Adhyaksh Name<input defaultValue={selectedMandal.contactName ?? selectedMandal.adhyakshName ?? ''} name="contactName" /></label>
                    <label>Contact Number<input defaultValue={selectedMandal.contactPhone ?? ''} inputMode="tel" name="contactPhone" placeholder="10-digit mobile number" /></label>
                    <label className="full">Replace Mandal Logo<input accept="image/*" name="logo" type="file" /></label>
                    <button className="primary full" disabled={mandalEditBusy} type="submit">{mandalEditBusy ? 'Saving Mandal...' : 'Save Mandal Details'}</button>
                  </form>
                  <div className="login-card">
                    <div className="panel-title">
                      <ShieldCheck size={22} />
                      <div>
                        <strong>{t(language, 'Adhyaksh Login')}</strong>
                        <span>Main mandal login to manage their team.</span>
                      </div>
                    </div>
                    <StatusLine label={t(language, 'Login URL')} value={mandalLoginUrl()} />
                    <StatusLine label={t(language, 'Username')} value={ownerLoginRows[0]?.username || `admin@${slugify(selectedMandal.name)}.local`} />
                    <StatusLine label={t(language, 'Password')} value={selectedMandal.adminPassword || 'Stored securely in backend'} />
                    {adminUser && <button className="owner-edit-login-button" onClick={() => setEditingLogin(adminUser)} type="button"><Edit3 size={16} />Edit Adhyaksh Username / Password</button>}
                  </div>
                  <form className="card form-grid" onSubmit={createLogin}>
                    <div className="panel-title full">
                      <Plus size={22} />
                      <div>
                        <strong>{t(language, 'Generate More Logins')}</strong>
                        <span>Khajindar, karyakari, group leader, or member.</span>
                      </div>
                    </div>
                    <label>Role<select name="role"><option>Khajindar</option><option>Karyakari</option><option>Group Leader</option><option>Member</option></select></label>
                    <label>Name<input name="name" required placeholder="User name" /></label>
                    <label>Username<input name="username" required placeholder="khajindar@mandal.local" /></label>
                    <label>Password<input name="password" required type="password" placeholder="Minimum 8 characters" /></label>
                    <button className="primary" disabled={loginBusy} type="submit"><Plus size={18} />{loginBusy ? 'Creating Login...' : t(language, 'Generate Login')}</button>
                    {loginMessage && <span className="full notice compact">{loginMessage}</span>}
                  </form>
                  <div className="table-list">
                    {ownerLoginRows.map((login) => (
                      <div className="table-row owner-login-row" key={`${login.role}-${login.username}`}>
                        <span className="avatar small">{login.role.charAt(0)}</span>
                        <strong>{login.role}</strong>
                        <span>{login.username}</span>
                        <em>{login.password}</em>
                        <span className="row-actions">
                          {login.userId && (
                            <button onClick={() => {
                              const user = activeUsers.find((item) => item.id === login.userId);
                              if (user) setEditingLogin(user);
                            }} type="button"><Edit3 size={16} />Edit</button>
                          )}
                          <button onClick={() => copyLogin(login)} type="button"><Copy size={16} />Copy</button>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {detailTab === 'template' && (
                <TemplateView
                  activeForm={null}
                  language={language}
                  latestTemplateVersion={selectedTemplateVersion}
                  onAddField={addOwnerTemplateField}
                  onPreviewChange={handleOwnerTemplatePreviewChange}
                  onPrompt={onPrompt}
                  onSaveTemplate={async (placements) => {
                    await onTemplateSaved(placements, {
                      festivalId: selectedMandal.festivals?.[0]?.id,
                      mandalId: selectedMandal.id,
                      previewUrl: selectedTemplatePreview,
                    });
                    // Keep the uploaded preview visible until a reload hydrates the
                    // newly persisted asset from the backend workspace response.
                  }}
                  templatePreview={selectedTemplatePreview}
                />
              )}
            </div>
          </section>
        )}
      </section>
    </main>
    {editingPartner && (
      <div className="modal-backdrop">
        <form className="vargani-modal owner-login-edit-modal" onSubmit={saveEditedPartner}>
          <button className="modal-close" disabled={loginBusy} onClick={() => setEditingPartner(null)} type="button"><X size={20} /></button>
          <div className="panel-title">
            <UsersRound size={22} />
            <div>
              <strong>Edit Partner</strong>
              <span>Update partner contact details used for mandal attribution.</span>
            </div>
          </div>
          <label>Name<input defaultValue={editingPartner.name} name="name" required /></label>
          <label>Email<input defaultValue={editingPartner.email ?? ''} name="email" placeholder="partner@example.com" type="email" /></label>
          <label>Mobile<input defaultValue={editingPartner.phone ?? ''} inputMode="tel" name="phone" placeholder="10-digit mobile number" /></label>
          <label>Address<input defaultValue={editingPartner.address ?? ''} name="address" /></label>
          <div className="modal-actions">
            <button disabled={loginBusy} onClick={() => setEditingPartner(null)} type="button">Cancel</button>
            <button className="primary" disabled={loginBusy} type="submit">{loginBusy ? 'Saving...' : 'Save Partner'}</button>
          </div>
        </form>
      </div>
    )}
    {editingLogin && (
      <div className="modal-backdrop">
        <form className="vargani-modal owner-login-edit-modal" onSubmit={saveEditedLogin}>
          <button className="modal-close" disabled={loginBusy} onClick={() => setEditingLogin(null)} type="button"><X size={20} /></button>
          <div className="panel-title">
            <UserCog size={22} />
            <div>
              <strong>Edit Login</strong>
              <span>Change username, account name, role, mobile number, or reset the password.</span>
            </div>
          </div>
          <label>Name<input defaultValue={editingLogin.name} name="name" required /></label>
          <label>Username (Email)<input defaultValue={editingLogin.email ?? ''} name="email" placeholder="user@mandal.local" type="email" /></label>
          <label>Mobile Login<input defaultValue={editingLogin.phone ?? ''} inputMode="tel" name="phone" placeholder="10-digit mobile number" /></label>
          <label>
            Role
            <select defaultValue={editingLogin.role} disabled={editingLogin.role === 'MANDAL_ADMIN'} name="role">
              <option value="MANDAL_ADMIN">Adhyaksh / Mandal Admin</option>
              <option value="KHAJINDAR">Khajindar</option>
              <option value="GROUP_LEADER">Group Leader / Karyakari</option>
              <option value="MEMBER">Member</option>
            </select>
          </label>
          <label>New Password<input autoComplete="new-password" minLength={8} name="password" placeholder="Leave blank to keep current password" type="password" /></label>
          <div className="modal-actions">
            <button disabled={loginBusy} onClick={() => setEditingLogin(null)} type="button">Cancel</button>
            <button className="primary" disabled={loginBusy} type="submit">{loginBusy ? 'Saving...' : 'Save Login Changes'}</button>
          </div>
        </form>
      </div>
    )}
    {loginBusy && <ActionLoaderOverlay message={editingPartner ? 'Updating partner...' : editingLogin ? 'Updating login...' : 'Creating login...'} />}
    </>
  );
}

function MandalCardGrid({
  items,
  onDelete,
  onManage,
}: {
  items: Array<{ index: number; mandal: DemoMandal }>;
  onDelete: (index: number) => void | Promise<void>;
  onManage: (index: number) => void;
}) {
  return (
    <section className="mandal-card-grid">
      {items.map(({ index, mandal }) => (
        <article className="owner-client-card" key={`${mandal.name}-${index}`}>
          <div className="mandal-card-topline" />
          <div className="owner-client-main">
            <MandalAvatar mandal={mandal} />
            <div>
              <strong>{mandal.name}</strong>
              <span>{mandal.address || mandal.locality || mandal.city || 'Location not set'}</span>
            </div>
          </div>
          <div className="mandal-card-meta">
            <span>{Number(mandal.memberCount || 0)} members</span>
            <span>{mandal.contactPhone || 'Phone pending'}</span>
            <span>{mandal.slipLimit ? `${mandal.slipLimit} slip limit` : 'Unlimited slips'}</span>
            <span>Registered by {mandal.partner?.name ?? 'No partner'}</span>
            <span>{mandal.whatsappMode === 'MANUAL_SHARE' ? 'Manual WhatsApp' : 'Paid WhatsApp API'}</span>
            <span>{mandal.whatsappTemplateName ? `WhatsApp: ${mandal.whatsappTemplateName}` : 'Default WhatsApp template'}</span>
            <em>Template Ready</em>
          </div>
          <div className="mandal-card-actions">
            <button onClick={() => onManage(index)} type="button">Manage</button>
            <button className="danger" onClick={() => void onDelete(index)} type="button">
              <Trash2 size={16} />Delete
            </button>
          </div>
        </article>
      ))}
      {!items.length && (
        <div className="empty-card">
          <Building2 size={34} />
          <strong>No mandals found</strong>
          <span>Try another search or add a new mandal.</span>
        </div>
      )}
    </section>
  );
}

function MandalAvatar({ mandal }: { mandal: DemoMandal }) {
  if (mandal.logoUrl) return <img alt="" className="mandal-avatar-img" src={mandal.logoUrl} />;
  return <span className="avatar">{mandal.name.charAt(0).toUpperCase()}</span>;
}

function getMandalIdentity(mandal: DemoMandal | null, session: AuthSession) {
  const fallbackName = session.user.mandalId ? 'Your Mandal' : 'Digital Vargani';
  const name = mandal?.name || fallbackName;
  const location = [mandal?.locality, mandal?.city].filter(Boolean).join(', ') || mandal?.address || 'Mandal workspace';
  return {
    address: mandal?.address || location,
    initials: name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'DV',
    location,
    logoUrl: mandal?.logoUrl || '',
    name,
    phone: mandal?.contactPhone || 'Phone not added',
  };
}

function PaymentStatusSelector({
  onChange,
  value,
}: {
  onChange: (value: 'ACTIVE' | 'PENDING') => void;
  value: 'ACTIVE' | 'PENDING';
}) {
  return (
    <fieldset className="payment-status-field">
      <legend>Payment Status *</legend>
      <div className="payment-status-grid">
        <label className={`payment-card paid ${value === 'ACTIVE' ? 'active' : ''}`}>
          <input
            checked={value === 'ACTIVE'}
            name="paymentStatus"
            onChange={() => onChange('ACTIVE')}
            type="radio"
            value="ACTIVE"
          />
          <CheckCircle2 size={24} />
          <strong>Payment Received</strong>
          <span>Slip will be generated</span>
        </label>
        <label className={`payment-card pending ${value === 'PENDING' ? 'active' : ''}`}>
          <input
            checked={value === 'PENDING'}
            name="paymentStatus"
            onChange={() => onChange('PENDING')}
            type="radio"
            value="PENDING"
          />
          <Clock size={24} />
          <strong>Pending</strong>
          <span>No slip until paid</span>
        </label>
      </div>
    </fieldset>
  );
}

function MemberCollectorApp({
  activeForm,
  busy,
  entryFields,
  mandal,
  modalOpen,
  notice,
  onDownloadSlip,
  onFilterSlips,
  onGenerate,
  onLoadMoreSlips,
  onLogout,
  onModalChange,
  onPrepareWhatsApp,
  onShareSlip,
  onTaskDone,
  session,
  setSelectedSlip,
  slipMeta,
  slips,
  tasks,
  workspaceMetrics,
  loadingMoreSlips,
}: {
  activeForm: ActiveForm | null;
  busy: boolean;
  entryFields: EntryFieldConfig[];
  mandal: DemoMandal | null;
  modalOpen: boolean;
  notice: string;
  onDownloadSlip: (slip: Slip) => Promise<void>;
  onFilterSlips: (filters: SlipListFilters) => Promise<void> | void;
  onGenerate: (event: FormEvent<HTMLFormElement>) => Promise<boolean | void> | boolean | void;
  onLoadMoreSlips: () => Promise<void> | void;
  onLogout: () => void;
  onModalChange: (open: boolean) => void;
  onPrepareWhatsApp: (paymentStatus: 'ACTIVE' | 'PENDING') => void;
  onShareSlip: (slip: Slip) => Promise<void>;
  onTaskDone: (task: FestivalTask) => Promise<void> | void;
  session: AuthSession;
  setSelectedSlip: (slip: Slip) => void;
  slipMeta: SlipPageMeta;
  slips: Slip[];
  tasks: FestivalTask[];
  workspaceMetrics: MandalMetrics;
  loadingMoreSlips: boolean;
}) {
  const [entryStatus, setEntryStatus] = useState<'ACTIVE' | 'PENDING'>('ACTIVE');
  const [activeSection, setActiveSection] = useState<'slips' | 'tasks'>('slips');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [slipFilter, setSlipFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [slipQuery, setSlipQuery] = useState('');
  const deferredSlipQuery = useDeferredValue(slipQuery);
  const slipFilterStartedRef = useRef(false);
  const mandalIdentity = getMandalIdentity(mandal, session);

  useEffect(() => {
    if (!isMemberRoute()) {
      writeRoute(routeForMember(), 'replace');
    }
  }, []);

  const { collected, filteredSlipRows, paidSlipRows, pendingSlipRows, visibleSlipCount } = useMemo(() => {
    const visibleSlips = slipsVisibleToSession(slips, session);
    const paid = visibleSlips.filter(isSlipPaid);
    const pending = visibleSlips.filter((slip) => !isSlipPaid(slip));
    const source = slipFilter === 'paid' ? paid : slipFilter === 'pending' ? pending : visibleSlips;
    const normalizedQuery = deferredSlipQuery.trim().toLowerCase();
    const filtered = normalizedQuery
      ? source.filter((slip) =>
          [slip.slipNumber, slip.contributorName, slip.shopName, slip.areaName, slip.contributorPhone]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
        )
      : source;

    return {
      collected: paid.reduce((sum, slip) => sum + Number(slip.amount), 0),
      filteredSlipRows: filtered,
      paidSlipRows: paid,
      pendingSlipRows: pending,
      visibleSlipCount: visibleSlips.length,
    };
  }, [deferredSlipQuery, session, slipFilter, slips]);
  const paidSlips = paidSlipRows.length;
  const totalSlipCount = Number(workspaceMetrics.slipTotalCount ?? slipMeta.total ?? filteredSlipRows.length);
  const paidSlipCount = Number(workspaceMetrics.slipPaidCount ?? paidSlips);
  const pendingSlipCount = Number(workspaceMetrics.slipPendingCount ?? pendingSlipRows.length);
  const collectedAmount = Number(workspaceMetrics.slipPaidAmount ?? collected);

  useEffect(() => {
    const hasFilters = Boolean(slipQuery.trim() || slipFilter !== 'all');
    if (!hasFilters && !slipFilterStartedRef.current) return;
    slipFilterStartedRef.current = true;
    const timer = window.setTimeout(() => {
      void onFilterSlips({
        search: slipQuery.trim() || undefined,
        status: slipFilter === 'paid' ? 'ACTIVE' : slipFilter === 'pending' ? 'PENDING' : undefined,
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [onFilterSlips, slipFilter, slipQuery]);
  const openTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED'),
    [tasks],
  );
  const doneTasks = tasks.filter((task) => task.status === 'DONE');
  const roleLabel = session.user.role === 'GROUP_LEADER' ? 'Group Leader' : 'Collection Member';

  function openMemberSection(section: 'slips' | 'tasks') {
    setActiveSection(section);
    window.scrollTo({ behavior: 'smooth', top: 0 });
    setSidebarOpen(false);
  }

  return (
    <main className={`member-shell collector-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="mobile-workspace-bar">
        <div className="mobile-workspace-brand">
          {mandalIdentity.logoUrl ? <img alt="" src={mandalIdentity.logoUrl} /> : <span>{mandalIdentity.initials}</span>}
          <div>
            <strong>{mandalIdentity.name}</strong>
            <small>{mandalIdentity.location}</small>
          </div>
        </div>
        <button
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          className="mobile-menu-toggle"
          onClick={() => setSidebarOpen((open) => !open)}
          type="button"
        >
          {sidebarOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {sidebarOpen && <button aria-label="Close menu" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} type="button" />}

      <aside className="member-sidebar">
        <div className="mandal-profile">
          {mandalIdentity.logoUrl ? <img alt="" className="mandal-avatar-img" src={mandalIdentity.logoUrl} /> : <div className="mandal-logo">{mandalIdentity.initials}</div>}
          <div>
            <h2>{mandalIdentity.name}</h2>
            <p>{mandalIdentity.location}</p>
          </div>
        </div>
        <div className="mandal-contact">
          <span>{mandalIdentity.address}</span>
          <span>{mandalIdentity.phone}</span>
        </div>
        <nav className="member-nav">
          <button className={activeSection === 'slips' ? 'active' : ''} onClick={() => openMemberSection('slips')} type="button">
            <ReceiptText size={20} />
            Vargani Slips
          </button>
          <button className={activeSection === 'tasks' ? 'active' : ''} onClick={() => openMemberSection('tasks')} type="button">
            <ShieldCheck size={20} />
            Assigned Tasks
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <span>{session.user.name.charAt(0)}</span>
            <div>
              <strong>{session.user.name}</strong>
              <small>{roleLabel}</small>
            </div>
          </div>
          <button className="logout" onClick={onLogout} type="button">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <section className="member-content">
        <header className="member-header">
          <div>
            <h1>{activeSection === 'tasks' ? 'Assigned Tasks' : 'Vargani Slips'}</h1>
            <p>{activeForm?.festival.name ?? 'Active Festival'} · {roleLabel}</p>
          </div>
          <select aria-label="Active year" disabled value={festivalYear(activeForm?.festival) ?? new Date().getFullYear()}>
            <option value={festivalYear(activeForm?.festival) ?? new Date().getFullYear()}>
              Year {festivalYear(activeForm?.festival) ?? new Date().getFullYear()}
            </option>
          </select>
        </header>

        {activeSection === 'slips' ? (
          <>
            <section className="member-hero" id="member-slips">
              <div>
                <h2>Vargani Slips</h2>
                <p>Generate and manage your vargani receipts</p>
              </div>
              <button className="primary" onClick={() => onModalChange(true)} type="button">
                <Plus size={18} />
                New Vargani Entry
              </button>
            </section>

            {(busy || notice) && <div className={`notice ${busy ? 'busy' : ''}`}>{busy ? 'Working...' : notice}</div>}

            <section className="member-stats">
              <Stat icon={<ReceiptText />} label="Total Entries" note={mandal?.slipLimit ? `Mandal limit: ${mandal.slipLimit}` : 'Your slips'} value={String(totalSlipCount)} />
              <Stat icon={<BadgeIndianRupee />} label="Collected" note={`${paidSlipCount} paid`} value={money(collectedAmount)} />
              <Stat icon={<CheckCircle2 />} label="Paid Slips" note="Generated receipts" value={String(paidSlipCount)} />
              <Stat icon={<FileText />} label="Pending Slips" note="No slip until paid" value={String(pendingSlipCount)} />
            </section>

            <section className="member-table-card">
              <div className="table-toolbar">
                <div className="tab-strip">
                  <button className={slipFilter === 'all' ? 'active' : ''} onClick={() => setSlipFilter('all')} type="button">All ({totalSlipCount})</button>
                  <button className={slipFilter === 'paid' ? 'active' : ''} onClick={() => setSlipFilter('paid')} type="button">Paid ({paidSlipCount})</button>
                  <button className={slipFilter === 'pending' ? 'active' : ''} onClick={() => setSlipFilter('pending')} type="button">Pending ({pendingSlipCount})</button>
                </div>
                <div className="search-box"><Search size={18} /><input onChange={(event) => setSlipQuery(event.target.value)} placeholder="Search by name, shop, location..." value={slipQuery} /></div>
              </div>
              <div className="member-slip-table">
                <div className="member-slip-head">
                  <span>Slip #</span><span>Name / Shop</span><span>Amount</span><span>Mobile</span><span>Status / Mode</span><span>Date</span><span>Actions</span>
                </div>
                {filteredSlipRows.map((slip) => (
                  <div
                    className="member-slip-row"
                    key={slip.id}
                    onClick={() => setSelectedSlip(slip)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') setSelectedSlip(slip);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <strong>{slip.slipNumber}</strong>
                    <span>{slip.contributorName}<small>{slip.shopName || slip.areaName || '-'}</small></span>
                    <b>{money(Number(slip.amount))}</b>
                    <span>{slip.contributorPhone || '-'}</span>
                    <em>{isSlipPaid(slip) ? 'Paid' : 'Pending'} - {slip.paymentMode}</em>
                    <span>{new Date(slip.createdAt).toLocaleDateString('en-IN')}</span>
                    <span className="row-actions" style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="mini-link"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedSlip(slip);
                          void onDownloadSlip(slip);
                        }}
                        type="button"
                      >
                        <Download size={15} /> Slip
                      </button>
                      <button
                        className="mini-link"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedSlip(slip);
                          void onShareSlip(slip);
                        }}
                        type="button"
                      >
                        <WhatsAppIcon size={15} /> WhatsApp
                      </button>
                    </span>
                  </div>
                ))}
                {filteredSlipRows.length === 0 && <div className="empty-state">No slips found for this filter.</div>}
                {slipMeta.page < slipMeta.totalPages && (
                  <div className="member-load-more">
                    <button disabled={loadingMoreSlips} onClick={() => void onLoadMoreSlips()} type="button">
                      {loadingMoreSlips ? 'Loading entries...' : `Load more (${visibleSlipCount} of ${slipMeta.total})`}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="member-hero" id="member-tasks">
              <div>
                <h2>Assigned Tasks</h2>
                <p>Work assigned to you or your collection group</p>
              </div>
              <span className="member-hero-count">{openTasks.length} open</span>
            </section>

            {(busy || notice) && <div className={`notice ${busy ? 'busy' : ''}`}>{busy ? 'Working...' : notice}</div>}

            <section className="member-stats">
              <Stat icon={<ShieldCheck />} label="Open Tasks" note="Need action" value={String(openTasks.length)} />
              <Stat icon={<CheckCircle2 />} label="Completed" note="Marked done" value={String(doneTasks.length)} />
              <Stat icon={<ClipboardList />} label="Total Tasks" note="Assigned work" value={String(tasks.length)} />
            </section>

            <section className="member-task-card">
              <div className="member-section-title">
                <div>
                  <h2>Task List</h2>
                  <p>Complete work once it is actually finished.</p>
                </div>
                <span>{openTasks.length} open</span>
              </div>
              <div className="member-task-list">
                {tasks.length === 0 && <div className="empty-state">No tasks assigned yet.</div>}
                {tasks.map((task) => (
                  <article className={`member-task-item ${task.status === 'DONE' ? 'done' : ''}`} key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <small>{task.notes || 'No notes added'}</small>
                      <span>{task.assignee?.name ? `Assigned to ${task.assignee.name}` : 'Group task'}{task.group?.name ? ` · ${task.group.name}` : ''}</span>
                    </div>
                    <div className="member-task-meta">
                      <i className={task.status === 'DONE' ? 'pill paid' : 'pill pending'}>{task.status.replaceAll('_', ' ')}</i>
                      <i className="pill mode">{task.priority}</i>
                      <small>{task.dueDate?.slice(0, 10) ?? 'No due date'}</small>
                    </div>
                    <button disabled={busy || task.status === 'DONE'} onClick={() => void onTaskDone(task)} type="button">
                      <CheckCircle2 size={17} />
                      {task.status === 'DONE' ? 'Done' : 'Mark Done'}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </section>

      {modalOpen && (
        <div className="modal-backdrop">
          <form
            className="vargani-modal"
            onSubmit={async (event) => {
              const ok = await onGenerate(event);
              if (ok === false) return;
              onModalChange(false);
              setEntryStatus('ACTIVE');
            }}
          >
            <button className="modal-close" onClick={() => onModalChange(false)} type="button">x</button>
            <div className="panel-title">
              <ReceiptText size={22} />
              <div>
                <strong>New Vargani Entry</strong>
                <span>Fill contribution details and generate slip.</span>
              </div>
            </div>
            <EntryCoreFields
              entryFields={entryFields}
              entryStatus={entryStatus}
              onEntryStatusChange={setEntryStatus}
              session={session}
            />
            {(activeForm?.customFields ?? []).map((field) => <CustomFieldInput field={field} key={field.id} />)}
            <div className="modal-actions">
              <button onClick={() => onModalChange(false)} type="button">Cancel</button>
              <button className={entryStatus === 'PENDING' ? 'pending-action' : 'success'} disabled={busy} onClick={(event) => { if (event.currentTarget.form?.checkValidity()) onPrepareWhatsApp(entryStatus); }} type="submit">{entryStatus === 'PENDING' ? <Clock size={18} /> : <CheckCircle2 size={18} />}{entryStatus === 'PENDING' ? 'Save as Pending' : 'Confirm & Generate Slip'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function ThemedDialogModal({
  dialog,
  onClose,
}: {
  dialog: ThemedDialogRequest;
  onClose: (value?: boolean | string | null) => void;
}) {
  const [value, setValue] = useState(dialog.type === 'prompt' ? dialog.defaultValue ?? '' : '');

  useEffect(() => {
    setValue(dialog.type === 'prompt' ? dialog.defaultValue ?? '' : '');
  }, [dialog]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog.type === 'prompt') onClose(value);
  }

  return (
    <div className="themed-dialog-backdrop" role="presentation">
      <form aria-modal="true" className={`themed-dialog ${dialog.danger ? 'danger' : ''}`} onSubmit={submit} role="dialog">
        <div className="themed-dialog-icon">
          {dialog.danger ? <Trash2 size={24} /> : dialog.type === 'prompt' ? <Edit3 size={24} /> : <ShieldCheck size={24} />}
        </div>
        <div className="themed-dialog-copy">
          <strong>{dialog.title}</strong>
          {dialog.message && <p>{dialog.message}</p>}
        </div>
        {dialog.type === 'prompt' && (
          <label className="themed-dialog-input">
            {dialog.multiline ? (
              <textarea
                aria-label={dialog.placeholder ?? dialog.title}
                autoFocus
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setValue(event.target.value)}
                placeholder={dialog.placeholder}
                value={value}
              />
            ) : (
              <input
                aria-label={dialog.placeholder ?? dialog.title}
                autoFocus
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setValue(event.target.value)}
                placeholder={dialog.placeholder}
                value={value}
              />
            )}
          </label>
        )}
        <div className="themed-dialog-actions">
          <button onClick={() => onClose(dialog.type === 'confirm' ? false : null)} type="button">
            {dialog.cancelLabel ?? 'Cancel'}
          </button>
          <button
            className={dialog.danger ? 'danger-action' : 'primary'}
            disabled={dialog.type === 'prompt' && Boolean(dialog.requiredValue) && value !== dialog.requiredValue}
            onClick={dialog.type === 'confirm' ? () => onClose(true) : undefined}
            type={dialog.type === 'confirm' ? 'button' : 'submit'}
          >
            {dialog.confirmLabel ?? (dialog.type === 'confirm' ? 'Confirm' : 'Save')}
          </button>
        </div>
      </form>
    </div>
  );
}

function LoginPanel({
  busy,
  notice,
  onSubmit,
}: {
  busy: boolean;
  notice: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [loginType, setLoginType] = useState<'owner' | 'mandal'>(() => {
    if (typeof window === 'undefined') return 'mandal';
    const params = new URLSearchParams(window.location.search);
    const route = cleanHash();
    return params.get('login') === 'owner' ||
      route === 'owner/login' ||
      route === 'super-admin/login' ||
      window.location.hash === '#owner'
      ? 'owner'
      : 'mandal';
  });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isOwner = loginType === 'owner';

  function setLoginMode(type: 'owner' | 'mandal') {
    setLoginType(type);
    writeRoute(routeForLogin(type === 'owner' ? 'owner' : 'mandal'));
  }

  useEffect(() => {
    const route = cleanHash();
    if (!['login', 'owner/login', 'super-admin/login'].includes(route)) {
      writeRoute(routeForLogin(isOwner ? 'owner' : 'mandal'), 'replace');
    }
  }, [isOwner]);

  useEffect(() => {
    function syncLoginRoute() {
      const route = cleanHash();
      if (route === 'owner/login' || route === 'super-admin/login' || window.location.hash === '#owner') {
        setLoginType('owner');
        return;
      }
      if (route === 'login') {
        setLoginType('mandal');
      }
    }

    window.addEventListener('hashchange', syncLoginRoute);
    window.addEventListener('popstate', syncLoginRoute);
    return () => {
      window.removeEventListener('hashchange', syncLoginRoute);
      window.removeEventListener('popstate', syncLoginRoute);
    };
  }, []);

  const shouldShowNotice = !busy && notice && notice !== 'Login with main mandal admin to open the console.';

  return (
    <main className="auth-page">
      <section className="auth-showcase" aria-label="Samavet ePawati benefits">
        <div className="auth-showcase-content">
          <img className="auth-samavet-logo" src="/samavet-logo-transparent.png" alt="Samavet" />

          <div className="auth-showcase-product">
            <span aria-hidden="true"><ReceiptText size={30} /></span>
            <div>
              <h2>ePawati</h2>
              <p>Digital receipts. Trusted records.</p>
            </div>
          </div>

          <p className="auth-showcase-kicker">Go digital. Save paper.</p>
          <p className="auth-showcase-copy">Create, manage and share donation receipts in seconds.</p>

          <div className="auth-benefits">
            <div>
              <ReceiptText size={22} aria-hidden="true" />
              <strong>Instant receipts</strong>
              <span>Create records in real time.</span>
            </div>
            <div>
              <Share2 size={22} aria-hidden="true" />
              <strong>Easy sharing</strong>
              <span>Share receipts with donors.</span>
            </div>
            <div>
              <ShieldCheck size={22} aria-hidden="true" />
              <strong>Secure records</strong>
              <span>Keep every entry organized.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          {isOwner && (
            <div className="auth-back-row">
              <span>Super Admin Access</span>
              <button
                onClick={() => setLoginMode('mandal')}
                type="button"
              >
                Back to Login
              </button>
            </div>
          )}

          <form className="login-panel clean" key={loginType} onSubmit={onSubmit}>
            <div className="auth-product-mark" aria-label="Samavet ePawati">
              <span className="auth-product-icon" aria-hidden="true">
                <ReceiptText size={22} />
              </span>
              <div>
                <strong>ePawati</strong>
                <span>by Samavet</span>
              </div>
            </div>

            <div className="auth-heading">
              <span>{isOwner ? 'Super admin portal' : 'Secure account access'}</span>
              <h1>Welcome back</h1>
              <p>Sign in to manage your ePawati account.</p>
            </div>

            <label>
              Username
              <input
                autoComplete="username"
                name="identifier"
                required
                defaultValue={isOwner ? DEFAULT_OWNER_IDENTIFIER : ''}
                placeholder={isOwner ? DEFAULT_OWNER_IDENTIFIER : 'Enter your username'}
              />
            </label>
            <label>
              Password
              <span className="password-field">
                <input
                  autoComplete="current-password"
                  minLength={8}
                  name="password"
                  required
                  type={passwordVisible ? 'text' : 'password'}
                  placeholder="Enter your password"
                />
                <button
                  aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  type="button"
                >
                  {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            <button aria-busy={busy} className="primary login-submit" disabled={busy} type="submit">
              {busy ? <span aria-hidden="true" className="simple-spinner button-spinner" /> : <ShieldCheck size={18} />}
              {busy ? 'Signing in' : 'Sign in securely'}
            </button>

            <p className="auth-security-note">
              <ShieldCheck size={14} aria-hidden="true" />
              Authorized users only
            </p>
          </form>

          {shouldShowNotice && <div aria-live="polite" className="notice">{notice}</div>}

          {isOwner && (
            <button className="auth-back-bottom" onClick={() => setLoginMode('mandal')} type="button">
              Back to Login
            </button>
          )}
        </div>

        <a className="auth-powered" href="https://www.bracketdex.com/" rel="noreferrer" target="_blank">
          Powered by BracketDex Technologies
        </a>
      </section>
    </main>
  );
}

function toMarathiDigits(val: string | number): string {
  const map: Record<string, string> = {
    '0': '०', '1': '१', '2': '२', '3': '३', '4': '४',
    '5': '५', '6': '६', '7': '७', '8': '८', '9': '९',
  };
  return String(val).replace(/[0-9]/g, (digit) => map[digit] ?? digit);
}

const MARATHI_WORD_MAP: Record<string, string> = {
  'Cash': 'नगद',
  'CASH': 'नगद (Cash)',
  'UPI': 'ऑनलाइन (UPI)',
  'CHEQUE': 'धनादेश (Cheque)',
  'BANK_TRANSFER': 'बँक ट्रान्सफर',
  'Main Road': 'मुख्य रस्ता',
  'Main Road, Pune': 'मुख्य रस्ता, पुणे',
  'Pune': 'पुणे',
  'Mahesh Traders': 'महेश ट्रेडर्स',
  'Sample Building': 'सॅम्पल बिल्डिंग',
  'Pramod': 'प्रमोद',
  'Amit Collector': 'अमित कलेक्टर',
  'Shop': 'दुकान',
};

function applyAutoMarathiTranslation(text: string, placement?: Partial<TemplatePlacement>): string {
  if (!placement?.autoMarathi && placement?.script !== 'Devanagari') return text;
  let translated = text;
  Object.entries(MARATHI_WORD_MAP).forEach(([eng, mr]) => {
    translated = translated.replace(new RegExp(eng, 'gi'), mr);
  });
  return toMarathiDigits(translated);
}

const RECEIPT_MARATHI_TEXT_FIELDS = new Set([
  'areaName',
  'building_name',
  'collectorName',
  'contributorAddress',
  'contributorAddressMr',
  'contributorName',
  'contributorNameMr',
  'donorType',
  'paymentMode',
  'receipt_note',
  'shopName',
]);

const RECEIPT_MARATHI_DIGIT_FIELDS = new Set(['amount', 'createdAt', 'slipNumber']);

const LATIN_TO_MARATHI_WORDS: Record<string, string> = {
  aditya: 'आदित्य',
  akash: 'आकाश',
  amit: 'अमित',
  aniket: 'अनिकेत',
  area: 'परिसर',
  barathe: 'बाराथे',
  building: 'बिल्डिंग',
  cash: 'नगद',
  chaudhari: 'चौधरी',
  chaudhary: 'चौधरी',
  chingu: 'चिंगू',
  choudhari: 'चौधरी',
  choudhary: 'चौधरी',
  chowdhari: 'चौधरी',
  chowdhary: 'चौधरी',
  collector: 'कलेक्टर',
  darshan: 'दर्शन',
  dhiraj: 'धीरज',
  gade: 'गाडे',
  gadhave: 'गाढवे',
  gadekar: 'गाडेकर',
  gaikwad: 'गायकवाड',
  ghorpade: 'घोरपडे',
  ghadekar: 'घाडेकर',
  gorpade: 'घोरपडे',
  group: 'गट',
  hande: 'हांडे',
  kakde: 'काकडे',
  lane: 'लेन',
  mahesh: 'महेश',
  main: 'मुख्य',
  mandal: 'मंडळ',
  mitra: 'मित्र',
  mogre: 'मोगरे',
  omkar: 'ओंकार',
  online: 'ऑनलाइन',
  pawan: 'पवन',
  prateek: 'प्रतीक',
  pratik: 'प्रतीक',
  pawar: 'पवार',
  pune: 'पुणे',
  road: 'रोड',
  rohan: 'रोहन',
  sample: 'सॅम्पल',
  shashikant: 'शशिकांत',
  shirsat: 'शिरसाट',
  shop: 'दुकान',
  siddharth: 'सिद्धार्थ',
  soshikant: 'सोशिकांत',
  suraj: 'सुरज',
  superkar: 'सुपेकर',
  traders: 'ट्रेडर्स',
  upi: 'यूपीआय',
  wanawadi: 'वानवडी',
  wanawadigaon: 'वानवडीगाव',
  wanowrie: 'वानवडी',
  wanwadi: 'वानवडी',
  wanwadigaon: 'वानवडीगाव',
  wasti: 'वस्ती',
  yash: 'यश',
  yogesh: 'योगेश',
};

const DEVANAGARI_VOWELS: Record<string, string> = {
  aa: 'आ',
  ai: 'ऐ',
  au: 'औ',
  ee: 'ई',
  ii: 'ई',
  oo: 'ऊ',
  a: 'अ',
  e: 'ए',
  i: 'इ',
  o: 'ओ',
  u: 'उ',
};

const DEVANAGARI_MATRAS: Record<string, string> = {
  aa: 'ा',
  ai: 'ै',
  au: 'ौ',
  ee: 'ी',
  ii: 'ी',
  oo: 'ू',
  a: '',
  e: 'े',
  i: 'ि',
  o: 'ो',
  u: 'ु',
};

const DEVANAGARI_CONSONANTS: Record<string, string> = {
  bh: 'भ',
  ch: 'च',
  dh: 'ध',
  gh: 'घ',
  jh: 'झ',
  kh: 'ख',
  ph: 'फ',
  sh: 'श',
  th: 'थ',
  b: 'ब',
  c: 'क',
  d: 'द',
  f: 'फ',
  g: 'ग',
  h: 'ह',
  j: 'ज',
  k: 'क',
  l: 'ल',
  m: 'म',
  n: 'न',
  p: 'प',
  q: 'क',
  r: 'र',
  s: 'स',
  t: 'त',
  v: 'व',
  w: 'व',
  x: 'क्स',
  y: 'य',
  z: 'झ',
};

const DEVANAGARI_LETTER_NAMES: Record<string, string> = {
  A: 'ए',
  B: 'बी',
  C: 'सी',
  D: 'डी',
  E: 'ई',
  F: 'एफ',
  G: 'जी',
  H: 'एच',
  I: 'आय',
  J: 'जे',
  K: 'के',
  L: 'एल',
  M: 'एम',
  N: 'एन',
  O: 'ओ',
  P: 'पी',
  Q: 'क्यू',
  R: 'आर',
  S: 'एस',
  T: 'टी',
  U: 'यू',
  V: 'वी',
  W: 'डब्ल्यू',
  X: 'एक्स',
  Y: 'वाय',
  Z: 'झेड',
};

function hasDevanagari(text: string) {
  return /[\u0900-\u097F]/.test(text);
}

function readToken(source: string, index: number, map: Record<string, string>) {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  return keys.find((key) => source.startsWith(key, index));
}

function transliterateLatinWordToMarathi(word: string) {
  if (!word || hasDevanagari(word)) return word;
  if (/^[A-Z]$/.test(word)) return DEVANAGARI_LETTER_NAMES[word] ?? word;
  if (/^[A-Z]{2,}$/.test(word)) {
    return word.split('').map((letter) => DEVANAGARI_LETTER_NAMES[letter] ?? letter).join('');
  }

  const exact = LATIN_TO_MARATHI_WORDS[word.toLowerCase()];
  if (exact) return exact;

  const lower = word.toLowerCase();
  let output = '';
  let index = 0;

  while (index < lower.length) {
    const vowel = readToken(lower, index, DEVANAGARI_VOWELS);
    if (vowel) {
      output += DEVANAGARI_VOWELS[vowel];
      index += vowel.length;
      continue;
    }

    const consonant = readToken(lower, index, DEVANAGARI_CONSONANTS);
    if (!consonant) {
      output += word[index] ?? '';
      index += 1;
      continue;
    }

    const nextIndex = index + consonant.length;
    const nextVowel = readToken(lower, nextIndex, DEVANAGARI_MATRAS);
    output += DEVANAGARI_CONSONANTS[consonant];

    if (nextVowel) {
      output += DEVANAGARI_MATRAS[nextVowel];
      index = nextIndex + nextVowel.length;
    } else {
      const hasMoreLatin = /[a-z]/.test(lower.slice(nextIndex));
      const nextIsConsonant = Boolean(readToken(lower, nextIndex, DEVANAGARI_CONSONANTS));
      output += hasMoreLatin && nextIsConsonant ? '्' : '';
      index = nextIndex;
    }
  }

  return output;
}

function transliterateReceiptTextToMarathi(text: string) {
  if (!text) return text;
  const withKnownWords = Object.entries(MARATHI_WORD_MAP).reduce(
    (current, [eng, mr]) => current.replace(new RegExp(eng, 'gi'), mr),
    text,
  );
  return toMarathiDigits(
    withKnownWords.replace(/[A-Za-z]+/g, (word) => transliterateLatinWordToMarathi(word)),
  );
}

function receiptRenderText(baseKey: string, text: string, amount: number) {
  if (baseKey === 'amountWords' || baseKey === 'amountWordsMarathi') {
    return amountToMarathiWords(amount);
  }
  if (RECEIPT_MARATHI_DIGIT_FIELDS.has(baseKey)) {
    return toMarathiDigits(text);
  }
  if (RECEIPT_MARATHI_TEXT_FIELDS.has(baseKey)) {
    return transliterateReceiptTextToMarathi(text);
  }
  return text;
}

const INDIAN_NUMBER_ONES = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const INDIAN_NUMBER_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function amountToIndianWords(value: number | string) {
  const amount = Math.floor(Number(value));
  if (!Number.isFinite(amount) || amount < 0) return '';
  return `${numberToIndianWords(amount)} Rupees Only`;
}

function numberToIndianWords(value: number): string {
  if (value === 0) return 'Zero';
  const parts: string[] = [];
  let remainder = value;
  const scales = [
    { label: 'Crore', value: 10000000 },
    { label: 'Lakh', value: 100000 },
    { label: 'Thousand', value: 1000 },
  ];

  scales.forEach((scale) => {
    const count = Math.floor(remainder / scale.value);
    if (count > 0) {
      parts.push(`${numberBelowThousand(count)} ${scale.label}`);
      remainder %= scale.value;
    }
  });

  if (remainder > 0) {
    parts.push(numberBelowThousand(remainder));
  }

  return parts.join(' ');
}

function numberBelowThousand(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  if (hundreds > 0) {
    parts.push(`${INDIAN_NUMBER_ONES[hundreds]} Hundred`);
  }

  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(INDIAN_NUMBER_ONES[remainder]);
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      parts.push(ones ? `${INDIAN_NUMBER_TENS[tens]} ${INDIAN_NUMBER_ONES[ones]}` : INDIAN_NUMBER_TENS[tens]);
    }
  }

  return parts.join(' ');
}

const MARATHI_NUMBER_BELOW_HUNDRED = [
  'शून्य',
  'एक',
  'दोन',
  'तीन',
  'चार',
  'पाच',
  'सहा',
  'सात',
  'आठ',
  'नऊ',
  'दहा',
  'अकरा',
  'बारा',
  'तेरा',
  'चौदा',
  'पंधरा',
  'सोळा',
  'सतरा',
  'अठरा',
  'एकोणीस',
  'वीस',
  'एकवीस',
  'बावीस',
  'तेवीस',
  'चोवीस',
  'पंचवीस',
  'सव्वीस',
  'सत्तावीस',
  'अठ्ठावीस',
  'एकोणतीस',
  'तीस',
  'एकतीस',
  'बत्तीस',
  'तेहतीस',
  'चौतीस',
  'पस्तीस',
  'छत्तीस',
  'सदतीस',
  'अडतीस',
  'एकोणचाळीस',
  'चाळीस',
  'एकेचाळीस',
  'बेचाळीस',
  'त्रेचाळीस',
  'चव्वेचाळीस',
  'पंचेचाळीस',
  'सेहेचाळीस',
  'सत्तेचाळीस',
  'अठ्ठेचाळीस',
  'एकोणपन्नास',
  'पन्नास',
  'एकावन्न',
  'बावन्न',
  'त्रेपन्न',
  'चौपन्न',
  'पंचावन्न',
  'छप्पन्न',
  'सत्तावन्न',
  'अठ्ठावन्न',
  'एकोणसाठ',
  'साठ',
  'एकसष्ट',
  'बासष्ट',
  'त्रेसष्ट',
  'चौसष्ट',
  'पासष्ट',
  'सहासष्ट',
  'सदुसष्ट',
  'अडुसष्ट',
  'एकोणसत्तर',
  'सत्तर',
  'एकाहत्तर',
  'बाहत्तर',
  'त्र्याहत्तर',
  'चौर्याहत्तर',
  'पंच्याहत्तर',
  'शहात्तर',
  'सत्याहत्तर',
  'अठ्ठ्याहत्तर',
  'एकोणऐंशी',
  'ऐंशी',
  'एक्याऐंशी',
  'ब्याऐंशी',
  'त्र्याऐंशी',
  'चौर्याऐंशी',
  'पंच्याऐंशी',
  'शहाऐंशी',
  'सत्त्याऐंशी',
  'अठ्ठ्याऐंशी',
  'एकोणनव्वद',
  'नव्वद',
  'एक्याण्णव',
  'ब्याण्णव',
  'त्र्याण्णव',
  'चौर्याण्णव',
  'पंच्याण्णव',
  'शहाण्णव',
  'सत्त्याण्णव',
  'अठ्ठ्याण्णव',
  'नव्याण्णव',
];

export function amountToMarathiWords(value: number | string) {
  const amount = Math.floor(Number(value));
  if (!Number.isFinite(amount) || amount < 0) return '';
  return `${numberToMarathiWords(amount)} रुपये फक्त`;
}

function numberToMarathiWords(value: number): string {
  if (value === 0) return 'शून्य';
  const parts: string[] = [];
  let remainder = value;
  const scales = [
    { label: 'कोटी', value: 10000000 },
    { label: 'लाख', value: 100000 },
    { label: 'हजार', value: 1000 },
  ];

  scales.forEach((scale) => {
    const count = Math.floor(remainder / scale.value);
    if (count > 0) {
      parts.push(`${numberBelowThousandMarathi(count)} ${scale.label}`);
      remainder %= scale.value;
    }
  });

  if (remainder > 0) {
    parts.push(numberBelowThousandMarathi(remainder));
  }

  return parts.join(' ');
}

function numberBelowThousandMarathi(value: number): string {
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const parts: string[] = [];

  if (hundreds > 0) {
    // Marathi uses "शंभर" for exactly 100, but "एकशे" when more digits follow.
    parts.push(hundreds === 1
      ? (remainder === 0 ? 'शंभर' : 'एकशे')
      : `${MARATHI_NUMBER_BELOW_HUNDRED[hundreds]}शे`);
  }

  if (remainder > 0) {
    parts.push(MARATHI_NUMBER_BELOW_HUNDRED[remainder]);
  }

  return parts.join(' ');
}

function sampleFieldValue(key: string, label: string, placement?: Partial<TemplatePlacement>) {
  const samples: Record<string, string> = {
    amount: '5100',
    amountWords: 'Five Thousand One Hundred Rupees Only',
    amountWordsMarathi: 'पाच हजार शंभर रुपये फक्त',
    areaName: 'Main Road',
    building_name: 'Sample Building',
    collectorName: 'Amit Collector',
    contributorAddress: 'Main Road, Pune',
    contributorAddressMr: 'मुख्य रस्ता, पुणे',
    contributorName: 'Mahesh Traders',
    contributorNameMr: 'महेश ट्रेडर्स',
    contributorPhone: '9876543210',
    createdAt: '26/07/2026',
    donorType: 'Shop',
    paymentMode: 'UPI',
    shopName: 'Mahesh Traders',
    slipNumber: '003',
  };
  const raw = samples[key] ?? label;
  const receiptPreview = receiptRenderText(key, raw, 5100);
  return applyAutoMarathiTranslation(receiptPreview, placement);
}

function FontDialogModal({
  initialPlacement,
  onClose,
  onSave,
  sampleText = 'AaBbYyZz · अमित कुलकर्णी ₹ ५,१००',
}: {
  initialPlacement: Partial<TemplatePlacement>;
  onClose: () => void;
  onSave: (updated: Partial<TemplatePlacement>) => void;
  sampleText?: string;
}) {
  const fonts = [
    { label: 'Century Gothic', value: '"Century Gothic", sans-serif' },
    { label: 'Noto Sans Devanagari', value: '"Noto Sans Devanagari", sans-serif' },
    { label: 'Microsoft Sans Serif', value: '"Microsoft Sans Serif", sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Arial Narrow', value: '"Arial Narrow", Arial, sans-serif' },
    { label: 'Helvetica', value: 'Helvetica, sans-serif' },
    { label: 'Tahoma', value: 'Tahoma, sans-serif' },
    { label: 'Yatra One', value: '"Yatra One", cursive' },
    { label: 'Rozha One', value: '"Rozha One", serif' },
    { label: 'Mukta', value: '"Mukta", sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", serif' },
  ];

  const fontStyles = [
    { fontStyle: 'normal', fontWeight: 400, label: 'Regular' },
    { fontStyle: 'italic', fontWeight: 400, label: 'Italic' },
    { fontStyle: 'normal', fontWeight: 700, label: 'Bold' },
    { fontStyle: 'italic', fontWeight: 700, label: 'Bold Italic' },
    { fontStyle: 'normal', fontWeight: 900, label: 'Narrow Bold' },
  ];

  const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 31, 36, 40, 48, 56, 64, 72, 80, 96];

  const [selectedFont, setSelectedFont] = useState(initialPlacement.fontFamily || '"Noto Sans Devanagari", sans-serif');
  const [selectedStyle, setSelectedStyle] = useState(
    initialPlacement.fontStyle === 'italic'
      ? initialPlacement.fontWeight && initialPlacement.fontWeight >= 700
        ? 'Bold Italic'
        : 'Italic'
      : initialPlacement.fontWeight && initialPlacement.fontWeight >= 850
      ? 'Narrow Bold'
      : initialPlacement.fontWeight && initialPlacement.fontWeight >= 700
      ? 'Bold'
      : 'Regular',
  );
  const [selectedSize, setSelectedSize] = useState(initialPlacement.fontSize || 24);
  const [underline, setUnderline] = useState(initialPlacement.textDecoration === 'underline');
  const [strikeout, setStrikeout] = useState(Boolean(initialPlacement.strikeout));
  const [shadow, setShadow] = useState(Boolean(initialPlacement.shadow));
  const [uppercase, setUppercase] = useState(initialPlacement.textTransform === 'uppercase');
  const [script, setScript] = useState(initialPlacement.script || 'Devanagari');
  const [autoMarathi, setAutoMarathi] = useState(Boolean(initialPlacement.autoMarathi));

  const currentStyleObj = fontStyles.find((s) => s.label === selectedStyle) || fontStyles[0];

  function handleSave() {
    onSave({
      autoMarathi,
      fontFamily: selectedFont,
      fontSize: Number(selectedSize),
      fontStyle: currentStyleObj.fontStyle as 'normal' | 'italic',
      fontWeight: currentStyleObj.fontWeight,
      script,
      shadow,
      strikeout,
      textDecoration: underline ? 'underline' : 'none',
      textTransform: uppercase ? 'uppercase' : 'none',
    });
    onClose();
  }

  const samplePreviewText = applyAutoMarathiTranslation(sampleText, { autoMarathi, script });

  return (
    <div className="font-dialog-backdrop" onClick={onClose}>
      <div className="font-dialog-box" onClick={(e) => e.stopPropagation()}>
        <div className="font-dialog-header">
          <span>Font</span>
          <button onClick={onClose} type="button">×</button>
        </div>

        <div className="font-dialog-body">
          <div className="font-dialog-columns">
            <div className="font-col">
              <label>Font</label>
              <input value={selectedFont.replaceAll('"', '').split(',')[0]} onChange={(e) => setSelectedFont(e.target.value)} />
              <div className="font-col-list">
                {fonts.map((f) => (
                  <button
                    className={selectedFont === f.value ? 'selected' : ''}
                    key={f.label}
                    onClick={() => setSelectedFont(f.value)}
                    type="button"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="font-col">
              <label>Font Style</label>
              <input value={selectedStyle} readOnly />
              <div className="font-col-list">
                {fontStyles.map((s) => (
                  <button
                    className={selectedStyle === s.label ? 'selected' : ''}
                    key={s.label}
                    onClick={() => setSelectedStyle(s.label)}
                    type="button"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="font-col">
              <label>Size</label>
              <input type="number" value={selectedSize} onChange={(e) => setSelectedSize(Number(e.target.value))} />
              <div className="font-col-list">
                {fontSizes.map((sz) => (
                  <button
                    className={selectedSize === sz ? 'selected' : ''}
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    type="button"
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <fieldset className="font-dialog-group">
            <legend>Effects</legend>
            <div className="effects-grid">
              <label><input type="checkbox" checked={strikeout} onChange={(e) => setStrikeout(e.target.checked)} /> Strikeout</label>
              <label><input type="checkbox" checked={underline} onChange={(e) => setUnderline(e.target.checked)} /> Underline</label>
              <label><input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} /> Shadow</label>
              <label><input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} /> Uppercase</label>
            </div>
          </fieldset>

          <fieldset className="font-dialog-group">
            <legend>Sample</legend>
            <div
              className="sample-box"
              style={{
                color: '#111',
                fontFamily: selectedFont,
                fontSize: `${Math.min(32, selectedSize)}px`,
                fontStyle: currentStyleObj.fontStyle,
                fontWeight: currentStyleObj.fontWeight,
                textDecoration: `${underline ? 'underline ' : ''}${strikeout ? 'line-through' : ''}`.trim() || 'none',
                textShadow: shadow ? '0 2px 4px rgba(0,0,0,0.35)' : 'none',
                textTransform: uppercase ? 'uppercase' : 'none',
              }}
            >
              {samplePreviewText}
            </div>
          </fieldset>
        </div>

        <div className="font-dialog-footer">
          <div className="script-select">
            <label>Script:</label>
            <select value={script} onChange={(e) => setScript(e.target.value)}>
              <option value="Devanagari">Devanagari (Marathi)</option>
              <option value="Western">Western</option>
            </select>
            <label style={{ marginLeft: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoMarathi} onChange={(e) => setAutoMarathi(e.target.checked)} /> Auto Marathi
            </label>
          </div>

          <div className="btn-group">
            <button className="primary-btn" onClick={handleSave} type="button">OK</button>
            <button onClick={onClose} type="button">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateView({
  activeForm,
  activeTemplate,
  language = 'en',
  latestTemplateVersion,
  onAddField,
  onPreviewChange,
  onPrompt,
  onSaveTemplate,
  templatePreview,
}: {
  activeForm: ActiveForm | null;
  activeTemplate?: Template;
  language?: Language;
  latestTemplateVersion?: Template['versions'][number];
  onAddField: (label: string, required?: boolean) => CustomField | void | Promise<CustomField | void>;
  onPreviewChange: (url: string) => void;
  onPrompt: (options: ThemedPromptOptions) => Promise<string | null>;
  onSaveTemplate?: (placements: Record<string, TemplatePlacement>) => Promise<void> | void;
  templatePreview: string;
}) {
  type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  type FieldInteraction =
    | { fieldKey: string; origin: TemplatePlacement; startX: number; startY: number; type: 'move' }
    | { fieldKey: string; handle: ResizeHandle; origin: TemplatePlacement; startX: number; startY: number; type: 'resize' };

  const [fieldLabel, setFieldLabel] = useState('');
  const [optionalFieldLabel, setOptionalFieldLabel] = useState('');
  const canvasWidth = latestTemplateVersion?.canvasWidth ?? 1328;
  const canvasHeight = latestTemplateVersion?.canvasHeight ?? 800;
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const [editorCustomFields, setEditorCustomFields] = useState<Array<{ key: string; label: string }>>([]);
  const fieldOptions = useMemo(
    () => uniqueTemplateFieldOptions([
        { key: 'slipNumber', label: 'Slip No.' },
        { key: 'createdAt', label: 'Date' },
        { key: 'contributorName', label: 'Name' },
        { key: 'contributorNameMr', label: 'Name in Marathi' },
        { key: 'contributorAddress', label: 'Address' },
        { key: 'contributorAddressMr', label: 'Address in Marathi' },
        { key: 'amount', label: 'Amount' },
        { key: 'amountWords', label: 'Amount in Words' },
        { key: 'amountWordsMarathi', label: 'Amount in Words (Marathi)' },
        { key: 'shopName', label: 'Shop Name' },
        { key: 'contributorPhone', label: 'Mobile No.' },
        { key: 'paymentMode', label: 'Payment Mode' },
        { key: 'areaName', label: 'Area' },
        { key: 'collectorName', label: 'Collector Name' },
        { key: 'donorType', label: 'Donor Type' },
        { key: 'building_name', label: 'Building / Lane' },
        ...(activeForm?.customFields ?? []).map((field) => ({ key: field.key, label: field.label })),
        ...editorCustomFields,
      ]),
    [activeForm?.customFields, editorCustomFields],
  );
  const [activeField, setActiveField] = useState('slipNumber');
  const [interaction, setInteraction] = useState<FieldInteraction | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const undoStackRef = useRef<Record<string, TemplatePlacement>[]>([]);
  const redoStackRef = useRef<Record<string, TemplatePlacement>[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ fieldKey: string; x: number; y: number } | null>(null);
  const [fontModalFieldKey, setFontModalFieldKey] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [placements, setPlacements] = useState<Record<string, TemplatePlacement>>(() => {
    const backendPlacements = normalizeTemplatePlacements(latestTemplateVersion?.renderConfig?.fields);
    if (Object.keys(backendPlacements).length > 0) return backendPlacements;
    return {
      amount: {
        ...defaultPlacement(),
        color: '#111111',
        fontSize: 31,
        fontWeight: 900,
        height: 52,
        textAlign: 'left',
        width: 250,
        x: 720,
        y: 680,
      },
      building_name: {
        ...defaultPlacement(),
        color: '#111111',
        fontSize: 24,
        fontWeight: 700,
        height: 48,
        textAlign: 'left',
        width: 420,
        x: 715,
        y: 623,
      },
      contributorAddress: {
        ...defaultPlacement(),
        color: '#111111',
        fontSize: 27,
        fontWeight: 800,
        height: 70,
        textAlign: 'left',
        textWrap: 'wrap',
        width: 560,
        x: 715,
        y: 574,
      },
      contributorName: {
        ...defaultPlacement(),
        color: '#111111',
        fontSize: 30,
        fontWeight: 900,
        height: 58,
        textAlign: 'left',
        width: 610,
        x: 670,
        y: 515,
      },
      createdAt: {
        ...defaultPlacement(),
        color: '#111111',
        fontSize: 25,
        fontWeight: 800,
        height: 46,
        textAlign: 'center',
        width: 160,
        x: 1115,
        y: 455,
      },
      slipNumber: {
        ...defaultPlacement(),
        color: '#b62028',
        fontSize: 31,
        fontWeight: 900,
        height: 48,
        textAlign: 'left',
        width: 100,
        x: 648,
        y: 445,
      },
    };
  });
  const selectedPlacement = placements[activeField] ?? defaultPlacement();
  const canUndo = historyVersion >= 0 && undoStackRef.current.length > 0;
  const canRedo = historyVersion >= 0 && redoStackRef.current.length > 0;
  const selectedPercent = {
    height: Number(((selectedPlacement.height / canvasHeight) * 100).toFixed(1)),
    width: Number(((selectedPlacement.width / canvasWidth) * 100).toFixed(1)),
    x: Number(((selectedPlacement.x / canvasWidth) * 100).toFixed(1)),
    y: Number(((selectedPlacement.y / canvasHeight) * 100).toFixed(1)),
  };

  const latestTemplateBackground = latestTemplateVersion?.backgroundFileUrl;
  const latestTemplateFields = latestTemplateVersion?.renderConfig?.fields;

  useEffect(() => {
    const backendPlacements = normalizeTemplatePlacements(latestTemplateFields);
    if (Object.keys(backendPlacements).length > 0) {
      setPlacements(backendPlacements);
    }
    const hasUnsavedPreview = templatePreview.startsWith('data:') || templatePreview.startsWith('blob:');
    if (latestTemplateBackground && !hasUnsavedPreview) {
      const resolvedBackground = resolveTemplateAssetUrl(latestTemplateBackground);
      if (resolvedBackground !== templatePreview) {
        onPreviewChange(resolvedBackground);
      }
    }
  }, [latestTemplateBackground, latestTemplateFields, latestTemplateVersion?.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasScale = () => {
      const renderedWidth = canvas.getBoundingClientRect().width;
      if (renderedWidth > 0) {
        setCanvasScale(Math.max(0.1, renderedWidth / canvasWidth));
      }
    };

    const observer = new ResizeObserver(updateCanvasScale);
    observer.observe(canvas);
    updateCanvasScale();

    return () => observer.disconnect();
  }, [canvasWidth]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && placements[activeField]) {
        event.preventDefault();
        if (!placements[activeField]?.locked) removePlacement(activeField);
      }
      if (event.key === 'Escape') setContextMenu(null);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeField, placements]);

  function pointFromClient(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp(Math.round(((clientX - rect.left) / rect.width) * canvasWidth), 0, canvasWidth),
      y: clamp(Math.round(((clientY - rect.top) / rect.height) * canvasHeight), 0, canvasHeight),
    };
  }

  function updatePlacement(fieldKey: string, partial: Partial<TemplatePlacement>) {
    setPlacements((current) => {
      if (current[fieldKey]?.locked && !Object.prototype.hasOwnProperty.call(partial, 'locked')) return current;
      undoStackRef.current = [...undoStackRef.current.slice(-59), clonePlacementMap(current)];
      redoStackRef.current = [];
      return {
        ...current,
        [fieldKey]: {
          ...defaultPlacement(),
          ...current[fieldKey],
          ...partial,
        },
      };
    });
    setHistoryVersion((value) => value + 1);
  }

  function updatePlacementLive(fieldKey: string, partial: Partial<TemplatePlacement>) {
    setPlacements((current) => {
      if (current[fieldKey]?.locked) return current;
      return {
        ...current,
        [fieldKey]: {
          ...defaultPlacement(),
          ...current[fieldKey],
          ...partial,
        },
      };
    });
  }

  function beginInteractionHistory() {
    undoStackRef.current = [...undoStackRef.current.slice(-59), clonePlacementMap(placements)];
    redoStackRef.current = [];
  }

  function finishInteraction() {
    if (!interaction) return;
    setInteraction(null);
    setHistoryVersion((value) => value + 1);
  }

  function undoPlacementChange() {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    setPlacements((current) => {
      redoStackRef.current = [...redoStackRef.current.slice(-59), clonePlacementMap(current)];
      return previous;
    });
    setHistoryVersion((value) => value + 1);
  }

  function redoPlacementChange() {
    const next = redoStackRef.current.pop();
    if (!next) return;
    setPlacements((current) => {
      undoStackRef.current = [...undoStackRef.current.slice(-59), clonePlacementMap(current)];
      return next;
    });
    setHistoryVersion((value) => value + 1);
  }

  function nudgeActiveField(deltaX: number, deltaY: number) {
    const placement = placements[activeField];
    if (!placement || placement.locked) return;
    updatePlacement(activeField, {
      x: clamp(placement.x + deltaX, 0, canvasWidth - placement.width),
      y: clamp(placement.y + deltaY, 0, canvasHeight - placement.height),
    });
  }

  function updatePlacementPercent(property: 'height' | 'width' | 'x' | 'y', percent: number) {
    const dimension = property === 'x' || property === 'width' ? canvasWidth : canvasHeight;
    updatePlacement(activeField, { [property]: Math.round((clamp(percent, 0, 100) / 100) * dimension) });
  }

  function snapValue(value: number) {
    return snapToGrid ? Math.round(value / 10) * 10 : Math.round(value);
  }

  function placeActiveField(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (event.target !== event.currentTarget) return;
    if (interaction) return;
    setContextMenu(null);
    const point = pointFromClient(event.clientX, event.clientY);
    const placement = placements[activeField] ?? defaultPlacement();
    if (placement.locked) return;
    updatePlacement(activeField, {
      x: clamp(snapValue(point.x), 0, canvasWidth - placement.width),
      y: clamp(snapValue(point.y), 0, canvasHeight - placement.height),
    });
  }

  function handleCanvasPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!interaction) return;
    event.preventDefault();
    const point = pointFromClient(event.clientX, event.clientY);
    const deltaX = point.x - interaction.startX;
    const deltaY = point.y - interaction.startY;
    const origin = interaction.origin;
    if (interaction.type === 'move') {
      updatePlacementLive(interaction.fieldKey, {
        x: clamp(snapValue(origin.x + deltaX), 0, canvasWidth - origin.width),
        y: clamp(snapValue(origin.y + deltaY), 0, canvasHeight - origin.height),
      });
      return;
    }

    let nextX = origin.x;
    let nextY = origin.y;
    let nextWidth = origin.width;
    let nextHeight = origin.height;
    if (interaction.handle.includes('e')) nextWidth = origin.width + deltaX;
    if (interaction.handle.includes('s')) nextHeight = origin.height + deltaY;
    if (interaction.handle.includes('w')) {
      nextX = origin.x + deltaX;
      nextWidth = origin.width - deltaX;
    }
    if (interaction.handle.includes('n')) {
      nextY = origin.y + deltaY;
      nextHeight = origin.height - deltaY;
    }
    nextWidth = clamp(nextWidth, 48, canvasWidth - nextX);
    nextHeight = clamp(nextHeight, 24, canvasHeight - nextY);
    nextX = clamp(nextX, 0, canvasWidth - nextWidth);
    nextY = clamp(nextY, 0, canvasHeight - nextHeight);
    const snappedX = clamp(snapValue(nextX), 0, canvasWidth - 48);
    const snappedY = clamp(snapValue(nextY), 0, canvasHeight - 24);
    updatePlacementLive(interaction.fieldKey, {
      height: clamp(snapValue(nextHeight), 24, canvasHeight - snappedY),
      width: clamp(snapValue(nextWidth), 48, canvasWidth - snappedX),
      x: snappedX,
      y: snappedY,
    });
  }

  function startMove(fieldKey: string, event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromClient(event.clientX, event.clientY);
    setActiveField(fieldKey);
    setContextMenu(null);
    if (placements[fieldKey]?.locked) return;
    beginInteractionHistory();
    setInteraction({
      fieldKey,
      origin: placements[fieldKey] ?? defaultPlacement(),
      startX: point.x,
      startY: point.y,
      type: 'move',
    });
  }

  function startResize(fieldKey: string, handle: ResizeHandle, event: PointerEvent<HTMLSpanElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromClient(event.clientX, event.clientY);
    setActiveField(fieldKey);
    setContextMenu(null);
    if (placements[fieldKey]?.locked) return;
    beginInteractionHistory();
    setInteraction({
      fieldKey,
      handle,
      origin: placements[fieldKey] ?? defaultPlacement(),
      startX: point.x,
      startY: point.y,
      type: 'resize',
    });
  }

  function removePlacement(fieldKey = activeField) {
    if (placements[fieldKey]?.locked) return;
    setPlacements((current) => {
      undoStackRef.current = [...undoStackRef.current.slice(-59), clonePlacementMap(current)];
      redoStackRef.current = [];
      const next = { ...current };
      delete next[fieldKey];
      return next;
    });
    setHistoryVersion((value) => value + 1);
    setContextMenu(null);
  }

  function duplicatePlacement(fieldKey = activeField) {
    const source = placements[fieldKey];
    if (!source) return;
    const duplicateKey = `${baseTemplateFieldKey(fieldKey)}_copy_${Date.now()}`;
    setPlacements((current) => {
      undoStackRef.current = [...undoStackRef.current.slice(-59), clonePlacementMap(current)];
      redoStackRef.current = [];
      return {
        ...current,
        [duplicateKey]: {
          ...source,
          locked: false,
          x: source.x + 24,
          y: source.y + 24,
        },
      };
    });
    setHistoryVersion((value) => value + 1);
    setActiveField(duplicateKey);
    setContextMenu(null);
  }

  function addTemplateField(fieldKey: string) {
    if (!placements[fieldKey]) {
      setActiveField(fieldKey);
      updatePlacement(fieldKey, defaultPlacement());
      return;
    }

    duplicatePlacement(fieldKey);
  }

  function bringPlacementForward(fieldKey = activeField) {
    const source = placements[fieldKey];
    if (!source) return;
    setPlacements((current) => {
      const next = { ...current };
      delete next[fieldKey];
      return { ...next, [fieldKey]: source };
    });
    setContextMenu(null);
  }

  function centerFieldOnSlip(fieldKey = activeField) {
    const source = placements[fieldKey] ?? defaultPlacement();
    updatePlacement(fieldKey, { x: Math.round((canvasWidth - source.width) / 2) });
    setContextMenu(null);
  }

  function fullWidthCenterField(fieldKey = activeField) {
    updatePlacement(fieldKey, {
      textAlign: 'center',
      width: canvasWidth - 80,
      x: 40,
    });
    setContextMenu(null);
  }

  function contextAction(fieldKey: string, action: string) {
    const source = placements[fieldKey] ?? defaultPlacement();
    const actions: Record<string, () => void> = {
      black: () => updatePlacement(fieldKey, { color: '#111111' }),
      bold: () => updatePlacement(fieldKey, { fontWeight: source.fontWeight >= 800 ? 500 : 900 }),
      border: () => updatePlacement(fieldKey, { borderColor: source.borderColor === 'transparent' ? '#ff4f0a' : 'transparent' }),
      capitalize: () => updatePlacement(fieldKey, { textTransform: source.textTransform === 'capitalize' ? 'none' : 'capitalize' }),
      center: () => updatePlacement(fieldKey, { textAlign: 'center' }),
      centerField: () => centerFieldOnSlip(fieldKey),
      delete: () => removePlacement(fieldKey),
      duplicate: () => duplicatePlacement(fieldKey),
      fontArial: () => updatePlacement(fieldKey, { fontFamily: 'Arial, sans-serif' }),
      fontDevanagari: () => updatePlacement(fieldKey, { fontFamily: '"Noto Sans Devanagari", Arial, sans-serif' }),
      fontGeorgia: () => updatePlacement(fieldKey, { fontFamily: 'Georgia, serif' }),
      fullWidth: () => fullWidthCenterField(fieldKey),
      grid: () => setShowGrid((value) => !value),
      italic: () => updatePlacement(fieldKey, { fontStyle: source.fontStyle === 'italic' ? 'normal' : 'italic' }),
      larger: () => updatePlacement(fieldKey, { fontSize: clamp(source.fontSize + 2, 8, 96) }),
      left: () => updatePlacement(fieldKey, { textAlign: 'left' }),
      orange: () => updatePlacement(fieldKey, { color: '#ff4f0a' }),
      red: () => updatePlacement(fieldKey, { color: '#b62028' }),
      resetRotate: () => updatePlacement(fieldKey, { rotate: 0 }),
      right: () => updatePlacement(fieldKey, { textAlign: 'right' }),
      rotateLeft: () => updatePlacement(fieldKey, { rotate: source.rotate - 5 }),
      rotateRight: () => updatePlacement(fieldKey, { rotate: source.rotate + 5 }),
      shadow: () => updatePlacement(fieldKey, { shadow: !source.shadow }),
      shrink: () => updatePlacement(fieldKey, { fontSize: clamp(source.fontSize - 2, 8, 96), textWrap: 'shrink' }),
      smaller: () => updatePlacement(fieldKey, { fontSize: clamp(source.fontSize - 2, 8, 96) }),
      splitHold: () => updatePlacement(fieldKey, { height: Math.max(source.height, source.fontSize * 2.7), textWrap: 'wrap' }),
      transparentBg: () => updatePlacement(fieldKey, { backgroundColor: 'transparent' }),
      underline: () => updatePlacement(fieldKey, { textDecoration: source.textDecoration === 'underline' ? 'none' : 'underline' }),
      uppercase: () => updatePlacement(fieldKey, { textTransform: source.textTransform === 'uppercase' ? 'none' : 'uppercase' }),
      whiteBg: () => updatePlacement(fieldKey, { backgroundColor: 'rgba(255, 255, 255, 0.78)' }),
      wrap: () => updatePlacement(fieldKey, { textWrap: source.textWrap === 'wrap' ? 'single' : 'wrap' }),
    };
    actions[action]?.();
  }

  async function handleAddEditorField(label: string, required: boolean) {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setSaveMessage('Enter a field name first');
      return;
    }
    try {
      const created = await onAddField(trimmedLabel, required);
      if (!created?.key) throw new Error('Field could not be created.');
      if (!activeForm) {
        setEditorCustomFields((current) => current.some((field) => field.key === created.key)
          ? current
          : [...current, { key: created.key, label: created.label }]);
      }
      addTemplateField(created.key);
      setActiveField(created.key);
      setSaveMessage(`${required ? 'Compulsory' : 'Optional'} field added`);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Could not add field');
    }
    window.setTimeout(() => setSaveMessage(''), 2600);
  }

  async function handleSaveTemplate() {
    setSaveMessage('Saving...');
    try {
      await onSaveTemplate?.(placements);
      setSaveMessage('Saved');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Save failed');
    }
    window.setTimeout(() => setSaveMessage(''), 2400);
  }

  return (
    <section className="template-grid">
      <div className="card template-stage">
        <div className="panel-title">
          <FileText size={22} />
          <div>
            <strong>{activeTemplate?.name ?? 'Vargani Receipt Template'}</strong>
            <span>
              {latestTemplateVersion
                ? `${latestTemplateVersion.canvasWidth} x ${latestTemplateVersion.canvasHeight}px active`
                : 'Upload and map fields over the slip'}
            </span>
          </div>
        </div>
        <div className="toolbar">
          <label className="upload-button">
            <Upload size={18} />
            {t(language, 'Upload Template')}
            <input
              accept="image/*"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const dataUrl = e.target?.result as string;
                    if (dataUrl) onPreviewChange(dataUrl);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>
          <button type="button"><SlidersHorizontal size={18} />{t(language, 'Slip Size')}</button>
          <button onClick={handleSaveTemplate} type="button"><CheckCircle2 size={18} />{t(language, 'Save Template')}</button>
          {saveMessage && <span className="template-save-toast"><CheckCircle2 size={16} />{t(language, saveMessage)}</span>}
        </div>
        <div className="canvas-editor-toolbar">
          <div className="editor-tool-group">
            <button disabled={!canUndo} onClick={undoPlacementChange} title="Undo" type="button"><Undo2 size={17} /></button>
            <button disabled={!canRedo} onClick={redoPlacementChange} title="Redo" type="button"><Redo2 size={17} /></button>
          </div>
          <div className="editor-tool-group zoom-controls">
            <button disabled={zoomPercent <= 50} onClick={() => setZoomPercent((value) => Math.max(50, value - 25))} title="Zoom out" type="button"><ZoomOut size={17} /></button>
            <strong>{zoomPercent}%</strong>
            <button disabled={zoomPercent >= 250} onClick={() => setZoomPercent((value) => Math.min(250, value + 25))} title="Zoom in" type="button"><ZoomIn size={17} /></button>
            <button onClick={() => setZoomPercent(100)} type="button">FIT</button>
          </div>
          <div className="editor-tool-group">
            <button className={showGrid ? 'active' : ''} onClick={() => setShowGrid((value) => !value)} type="button"><Grid3X3 size={17} />Grid</button>
            <button className={snapToGrid ? 'active' : ''} onClick={() => setSnapToGrid((value) => !value)} type="button"><Magnet size={17} />Snap</button>
            <button className={showRulers ? 'active' : ''} onClick={() => setShowRulers((value) => !value)} type="button"><Ruler size={17} />Rulers</button>
            <button
              className={selectedPlacement.locked ? 'active locked' : ''}
              disabled={!placements[activeField]}
              onClick={() => updatePlacement(activeField, { locked: !selectedPlacement.locked })}
              type="button"
            >
              {selectedPlacement.locked ? <LockKeyhole size={17} /> : <Unlock size={17} />}
              {selectedPlacement.locked ? 'Locked' : 'Lock'}
            </button>
          </div>
          <span className="editor-coordinate-readout">X {selectedPercent.x}% · Y {selectedPercent.y}% · W {selectedPercent.width}% · H {selectedPercent.height}%</span>
        </div>
        <div className={`template-canvas ${showRulers ? 'with-rulers' : ''}`}>
          <div
            className={`template-map-canvas ${showGrid ? 'show-grid' : ''}`}
            ref={canvasRef}
            onPointerDown={placeActiveField}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={finishInteraction}
            onPointerCancel={finishInteraction}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu(null);
            }}
            style={{
              aspectRatio: `${canvasWidth} / ${canvasHeight}`,
              maxWidth: zoomPercent > 100 ? 'none' : '100%',
              width: `${zoomPercent}%`,
            }}
          >
            <img alt="Vargani slip template" src={templatePreview} />
            {Object.entries(placements).map(([key, placement]) => {
              const baseKey = baseTemplateFieldKey(key);
              const field = fieldOptions.find((item) => item.key === baseKey);
              const sampleValue = sampleFieldValue(baseKey, field?.label ?? baseKey, placement);
              const fontSize =
                placement.textWrap === 'shrink' && sampleValue.length > 18
                  ? Math.max(10, placement.fontSize - Math.ceil((sampleValue.length - 18) / 3))
                  : placement.fontSize;
              return (
                <div
                  className={`field-anchor ${activeField === key ? 'active' : ''} ${placement.locked ? 'locked' : ''}`}
                  key={key}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setActiveField(key);
                    setContextMenu({ fieldKey: key, x: event.clientX, y: event.clientY });
                  }}
                  onPointerDown={(event) => startMove(key, event)}
                  role="button"
                  style={{
                    alignItems: placement.textWrap === 'single' ? 'center' : 'flex-start',
                    backgroundColor: placement.backgroundColor,
                    borderColor: placement.borderColor,
                    borderRadius: `${placement.borderRadius * canvasScale}px`,
                    color: placement.color,
                    fontFamily: placement.fontFamily,
                    fontSize: `${fontSize * canvasScale}px`,
                    fontStyle: placement.fontStyle,
                    fontWeight: placement.fontWeight,
                    height: `${(placement.height / canvasHeight) * 100}%`,
                    left: `${(placement.x / canvasWidth) * 100}%`,
                    letterSpacing: `${placement.letterSpacing * canvasScale}px`,
                    lineHeight: placement.lineHeight,
                    opacity: placement.opacity,
                    padding: `${placement.padding * canvasScale}px`,
                    textDecoration: placement.textDecoration,
                    textAlign: placement.textAlign,
                    textShadow: placement.shadow ? '0 2px 4px rgba(0, 0, 0, 0.35)' : 'none',
                    textTransform: placement.textTransform,
                    top: `${(placement.y / canvasHeight) * 100}%`,
                    transform: `rotate(${placement.rotate}deg)`,
                    width: `${(placement.width / canvasWidth) * 100}%`,
                    whiteSpace: placement.textWrap === 'single' ? 'nowrap' : 'normal',
                    wordBreak: placement.textWrap === 'single' ? 'normal' : 'break-word',
                  }}
                  tabIndex={0}
                >
                  <span>{sampleValue}</span>
                  {activeField === key && !placement.locked && (
                    <>
                      {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]).map((handle) => (
                        <span
                          aria-hidden="true"
                          className={`resize-handle handle-${handle}`}
                          key={handle}
                          onPointerDown={(event) => startResize(key, handle, event)}
                        />
                      ))}
                    </>
                  )}
                </div>
              );
            })}
            {contextMenu && (
              <div
                className="field-context-menu hierarchical"
                style={{
                  left: `${contextMenu.x}px`,
                  top: `${contextMenu.y}px`,
                }}
              >
                <div className="menu-item has-submenu">
                  <span>Image Properties</span>
                  <ChevronRight size={14} />
                  <div className="submenu">
                    <button onClick={() => { updatePlacement(contextMenu.fieldKey, { opacity: 0.8 }); setContextMenu(null); }} type="button">Opacity: 80%</button>
                    <button onClick={() => { updatePlacement(contextMenu.fieldKey, { opacity: 1 }); setContextMenu(null); }} type="button">Opacity: 100%</button>
                    <button onClick={() => { updatePlacement(contextMenu.fieldKey, { borderRadius: 12 }); setContextMenu(null); }} type="button">Rounded Corners (12px)</button>
                    <button onClick={() => { updatePlacement(contextMenu.fieldKey, { borderRadius: 0 }); setContextMenu(null); }} type="button">Square Corners (0px)</button>
                  </div>
                </div>

                <div className="menu-item has-submenu">
                  <span>Text Properties</span>
                  <ChevronRight size={14} />
                  <div className="submenu">
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'larger'); setContextMenu(null); }} type="button">Increase Text Size</button>
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'smaller'); setContextMenu(null); }} type="button">Reduce Text Size</button>
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'bold'); setContextMenu(null); }} type="button">Bold / Normal</button>
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'italic'); setContextMenu(null); }} type="button">Italic</button>
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'underline'); setContextMenu(null); }} type="button">Underline</button>
                    <button onClick={() => { setFontModalFieldKey(contextMenu.fieldKey); setContextMenu(null); }} type="button">Font Dialog...</button>
                    <button onClick={() => { updatePlacement(contextMenu.fieldKey, { autoMarathi: !placements[contextMenu.fieldKey]?.autoMarathi }); setContextMenu(null); }} type="button">Auto Marathi Translation</button>
                  </div>
                </div>

                <div className="menu-item has-submenu">
                  <span>Background Properties</span>
                  <ChevronRight size={14} />
                  <div className="submenu">
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'transparentBg'); setContextMenu(null); }} type="button">Transparent Background</button>
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'whiteBg'); setContextMenu(null); }} type="button">White Background</button>
                    <button onClick={() => { updatePlacement(contextMenu.fieldKey, { backgroundColor: '#fff3d5' }); setContextMenu(null); }} type="button">Yellow Highlight Tint</button>
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'border'); setContextMenu(null); }} type="button">Toggle Border</button>
                  </div>
                </div>

                <div className="menu-item has-submenu">
                  <span>Alignments</span>
                  <ChevronRight size={14} />
                  <div className="submenu">
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'left'); setContextMenu(null); }} type="button">Align Left</button>
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'center'); setContextMenu(null); }} type="button">Align Center</button>
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'right'); setContextMenu(null); }} type="button">Align Right</button>
                  </div>
                </div>

                <button className="menu-item" onClick={() => { contextAction(contextMenu.fieldKey, 'grid'); setContextMenu(null); }} type="button">
                  <span>Grid View</span>
                </button>

                <div className="menu-divider" />

                <button className="menu-item" onClick={() => { contextAction(contextMenu.fieldKey, 'centerField'); setContextMenu(null); }} type="button">
                  <span>Center Field on Card</span>
                </button>

                <button className="menu-item" onClick={() => { contextAction(contextMenu.fieldKey, 'fullWidth'); setContextMenu(null); }} type="button">
                  <span>Full Width + Center Text</span>
                </button>

                <button
                  className="menu-item"
                  onClick={async () => {
                    const current = placements[contextMenu.fieldKey] ?? defaultPlacement();
                    const fieldKey = contextMenu.fieldKey;
                    setContextMenu(null);
                    const input = await onPrompt({
                      defaultValue: `${current.x}, ${current.y}`,
                      message: 'Enter X and Y coordinates separated by comma.',
                      placeholder: '720, 680',
                      title: 'Set text axis',
                    });
                    if (input) {
                      const [x, y] = input.split(',').map((val) => parseInt(val.trim(), 10));
                      if (!isNaN(x) && !isNaN(y)) {
                        updatePlacement(fieldKey, { x, y });
                      }
                    }
                  }}
                  type="button"
                >
                  <span>Set Text Axis (X, Y)</span>
                </button>

                <div className="menu-item has-submenu">
                  <span>Color</span>
                  <ChevronRight size={14} />
                  <div className="submenu">
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'black'); setContextMenu(null); }} type="button">Black (#111111)</button>
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'red'); setContextMenu(null); }} type="button">Receipt Red (#b62028)</button>
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'orange'); setContextMenu(null); }} type="button">Orange (#ff4f0a)</button>
                    <button onClick={() => { updatePlacement(contextMenu.fieldKey, { color: '#059669' }); setContextMenu(null); }} type="button">Green (#059669)</button>
                    <button onClick={() => { updatePlacement(contextMenu.fieldKey, { color: '#2563eb' }); setContextMenu(null); }} type="button">Blue (#2563eb)</button>
                  </div>
                </div>

                <div className="menu-item has-submenu">
                  <span>Rotate</span>
                  <ChevronRight size={14} />
                  <div className="submenu">
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'rotateLeft'); setContextMenu(null); }} type="button">Rotate -5°</button>
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'rotateRight'); setContextMenu(null); }} type="button">Rotate +5°</button>
                    <button onClick={() => { contextAction(contextMenu.fieldKey, 'resetRotate'); setContextMenu(null); }} type="button">Reset 0°</button>
                  </div>
                </div>

                <button
                  className="menu-item highlighted"
                  onClick={() => {
                    setFontModalFieldKey(contextMenu.fieldKey);
                    setContextMenu(null);
                  }}
                  type="button"
                >
                  <span>Font (Font Dialog)...</span>
                </button>

                <div className="menu-divider" />

                <button className="menu-item" onClick={() => { contextAction(contextMenu.fieldKey, 'splitHold'); setContextMenu(null); }} type="button">
                  <span>Split Hold Size</span>
                </button>

                <button className="menu-item" onClick={() => { contextAction(contextMenu.fieldKey, 'wrap'); setContextMenu(null); }} type="button">
                  <span>WordWrap / Rotate Reduce Font Size</span>
                </button>

                <div className="menu-item has-submenu">
                  <span>Layer</span>
                  <ChevronRight size={14} />
                  <div className="submenu">
                    <button onClick={() => { removePlacement(contextMenu.fieldKey); setContextMenu(null); }} type="button">Delete Field</button>
                    <button onClick={() => { duplicatePlacement(contextMenu.fieldKey); setContextMenu(null); }} type="button">Duplicate Field</button>
                    <button onClick={() => { bringPlacementForward(contextMenu.fieldKey); setContextMenu(null); }} type="button">Bring To Front</button>
                  </div>
                </div>

                <button
                  className="menu-item marathi-item"
                  onClick={() => {
                    updatePlacement(contextMenu.fieldKey, { autoMarathi: !placements[contextMenu.fieldKey]?.autoMarathi });
                    setContextMenu(null);
                  }}
                  type="button"
                >
                  <span>{placements[contextMenu.fieldKey]?.autoMarathi ? '✓ Marathi Translation ON' : 'Auto Marathi Translation (मराठी)'}</span>
                </button>
              </div>
            )}

            {fontModalFieldKey && (
              <FontDialogModal
                initialPlacement={placements[fontModalFieldKey] ?? defaultPlacement()}
                onClose={() => setFontModalFieldKey(null)}
                onSave={(updated) => updatePlacement(fontModalFieldKey, updated)}
                sampleText={sampleFieldValue(
                  baseTemplateFieldKey(fontModalFieldKey),
                  fieldOptions.find((f) => f.key === baseTemplateFieldKey(fontModalFieldKey))?.label ?? baseTemplateFieldKey(fontModalFieldKey),
                )}
              />
            )}
          </div>
        </div>
      </div>
      <aside className="card settings-panel">
        <div className="template-settings">
          <strong>{t(language, 'Slip Settings')}</strong>
          <label>
            {t(language, 'Template Size')}
            <select defaultValue="landscape">
              <option value="landscape">Landscape Vargani Slip</option>
              <option value="portrait">Portrait Receipt</option>
              <option value="custom">Custom Size</option>
            </select>
          </label>
          <div className="mini-grid">
            <label>Width<input defaultValue="1328" /></label>
            <label>Height<input defaultValue="800" /></label>
          </div>
          <div className="mini-grid">
            <label>DPI<select defaultValue="300"><option value="300">300 DPI Standard</option><option value="150">150 DPI Preview</option></select></label>
            <label>Bleed (mm)<input defaultValue="1" /></label>
          </div>
        </div>
        <div className="panel-title">
          <Settings size={22} />
          <div>
            <strong>{t(language, 'Field Mapping')}</strong>
            <span>{t(language, 'Place boxes exactly on printed slip labels.')}</span>
          </div>
        </div>
        <strong className="quick-add-title">Quick Add Receipt Fields</strong>
        <div className="field-pills">
          {fieldOptions.map((field) => (
            <button
              className={baseTemplateFieldKey(activeField) === field.key ? 'active' : ''}
              key={field.key}
              onClick={() => {
                addTemplateField(field.key);
              }}
              type="button"
            >
              + {field.label}
            </button>
          ))}
        </div>
        <div className="template-settings">
          <div className="selected-field-heading">
            <strong>{t(language, 'Selected Field')}: {templateFieldLabel(activeField, fieldOptions, placements)}</strong>
            <span className={selectedPlacement.locked ? 'locked' : ''}>{selectedPlacement.locked ? 'Locked' : 'Editable'}</span>
          </div>
          <div className="field-nudge-controls" aria-label="Nudge selected field">
            <button disabled={selectedPlacement.locked} onClick={() => nudgeActiveField(0, -1)} title="Move up" type="button">↑</button>
            <button disabled={selectedPlacement.locked} onClick={() => nudgeActiveField(-1, 0)} title="Move left" type="button">←</button>
            <button disabled={selectedPlacement.locked} onClick={() => nudgeActiveField(1, 0)} title="Move right" type="button">→</button>
            <button disabled={selectedPlacement.locked} onClick={() => nudgeActiveField(0, 1)} title="Move down" type="button">↓</button>
            <button onClick={() => duplicatePlacement(activeField)} type="button">Duplicate</button>
          </div>
          <div className="mini-grid">
            <label>X<input type="number" value={selectedPlacement.x} onChange={(event) => updatePlacement(activeField, { x: Number(event.target.value) })} /></label>
            <label>Y<input type="number" value={selectedPlacement.y} onChange={(event) => updatePlacement(activeField, { y: Number(event.target.value) })} /></label>
            <label>Width<input type="number" value={selectedPlacement.width} onChange={(event) => updatePlacement(activeField, { width: Number(event.target.value) })} /></label>
            <label>Height<input type="number" value={selectedPlacement.height} onChange={(event) => updatePlacement(activeField, { height: Number(event.target.value) })} /></label>
          </div>
          <label className="range-setting">Font Size: {selectedPlacement.fontSize}px<input disabled={selectedPlacement.locked} max="96" min="8" type="range" value={selectedPlacement.fontSize} onChange={(event) => updatePlacement(activeField, { fontSize: Number(event.target.value) })} /></label>
          <div className="mini-grid">
            <label>Font Size<input type="number" value={selectedPlacement.fontSize} onChange={(event) => updatePlacement(activeField, { fontSize: Number(event.target.value) })} /></label>
            <label>Align<select value={selectedPlacement.textAlign} onChange={(event) => updatePlacement(activeField, { textAlign: event.target.value as TextAlign })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
          </div>
          <label>Font Family<select value={selectedPlacement.fontFamily} onChange={(event) => updatePlacement(activeField, { fontFamily: event.target.value })}><option value="Arial, sans-serif">Arial</option><option value='"Noto Sans Devanagari", Arial, sans-serif'>Noto Sans Devanagari</option><option value="Inter, Arial, sans-serif">Inter</option><option value="Georgia, serif">Georgia</option><option value='"Arial Narrow", Arial, sans-serif'>Arial Narrow</option><option value='"Trebuchet MS", Arial, sans-serif'>Trebuchet</option><option value='"Courier New", monospace'>Courier New</option></select></label>
          <div className="mini-grid">
            <label>Weight<select value={selectedPlacement.fontWeight} onChange={(event) => updatePlacement(activeField, { fontWeight: Number(event.target.value) })}><option value={400}>Regular</option><option value={700}>Bold</option><option value={800}>Extra Bold</option><option value={900}>Black</option></select></label>
            <label>Wrap<select value={selectedPlacement.textWrap} onChange={(event) => updatePlacement(activeField, { textWrap: event.target.value as TextWrapMode })}><option value="single">Single line</option><option value="wrap">Word wrap</option><option value="shrink">Auto reduce</option></select></label>
          </div>
          <div className="field-style-buttons">
            <button className={selectedPlacement.fontWeight >= 800 ? 'active' : ''} onClick={() => contextAction(activeField, 'bold')} type="button">B</button>
            <button className={selectedPlacement.fontStyle === 'italic' ? 'active' : ''} onClick={() => contextAction(activeField, 'italic')} type="button">I</button>
            <button className={selectedPlacement.textDecoration === 'underline' ? 'active' : ''} onClick={() => contextAction(activeField, 'underline')} type="button">U</button>
            <button className={selectedPlacement.shadow ? 'active' : ''} onClick={() => contextAction(activeField, 'shadow')} type="button">Shadow</button>
          </div>
          <div className="color-preset-row" aria-label="Font color presets">
            {['#111111', '#ffffff', '#64748b', '#dc2626', '#f97316', '#16a34a', '#0284c7', '#2563eb', '#7c3aed', '#db2777'].map((color) => (
              <button aria-label={`Use ${color}`} className={selectedPlacement.color === color ? 'active' : ''} key={color} onClick={() => updatePlacement(activeField, { color })} style={{ backgroundColor: color }} type="button" />
            ))}
          </div>
          <div className="mini-grid">
            <label>Text Color<input type="color" value={selectedPlacement.color} onChange={(event) => updatePlacement(activeField, { color: event.target.value })} /></label>
            <label>Background<input type="color" value={toColorInput(selectedPlacement.backgroundColor)} onChange={(event) => updatePlacement(activeField, { backgroundColor: event.target.value })} /></label>
          </div>
          <div className="property-button-grid four">
            <button className={selectedPlacement.textWrap === 'single' ? 'active' : ''} onClick={() => updatePlacement(activeField, { textWrap: 'single' })} type="button">No Wrap</button>
            <button className={selectedPlacement.textWrap === 'wrap' ? 'active' : ''} onClick={() => updatePlacement(activeField, { textWrap: 'wrap' })} type="button">Multi-line</button>
            <button className={selectedPlacement.textWrap === 'shrink' ? 'active' : ''} onClick={() => updatePlacement(activeField, { textWrap: 'shrink' })} type="button">Auto-fit</button>
            <button onClick={() => updatePlacement(activeField, { textAlign: 'center', textWrap: 'wrap' })} type="button">Centered</button>
          </div>
          <div className="property-button-grid four">
            <button className={selectedPlacement.textTransform === 'none' ? 'active' : ''} onClick={() => updatePlacement(activeField, { textTransform: 'none' })} type="button">Aa</button>
            <button className={selectedPlacement.textTransform === 'uppercase' ? 'active' : ''} onClick={() => updatePlacement(activeField, { textTransform: 'uppercase' })} type="button">AA</button>
            <button onClick={() => updatePlacement(activeField, { textTransform: 'none' })} type="button">aa</button>
            <button className={selectedPlacement.textTransform === 'capitalize' ? 'active' : ''} onClick={() => updatePlacement(activeField, { textTransform: 'capitalize' })} type="button">Aa+</button>
          </div>
          <div className="range-pair">
            <label>Letter Spacing: {selectedPlacement.letterSpacing}px<input disabled={selectedPlacement.locked} max="20" min="-2" type="range" value={selectedPlacement.letterSpacing} onChange={(event) => updatePlacement(activeField, { letterSpacing: Number(event.target.value) })} /></label>
            <label>Line Height: {selectedPlacement.lineHeight}<input disabled={selectedPlacement.locked} max="2.5" min="0.8" step="0.05" type="range" value={selectedPlacement.lineHeight} onChange={(event) => updatePlacement(activeField, { lineHeight: Number(event.target.value) })} /></label>
          </div>
          <strong className="position-size-title">Position &amp; Size (%)</strong>
          <div className="percent-control-grid">
            {(['x', 'y', 'width', 'height'] as const).map((property) => (
              <label key={property}>{property === 'width' ? 'W' : property === 'height' ? 'H' : property.toUpperCase()}
                <input disabled={selectedPlacement.locked} max="100" min="0" step="0.1" type="number" value={selectedPercent[property]} onChange={(event) => updatePlacementPercent(property, Number(event.target.value))} />
                <input disabled={selectedPlacement.locked} max="100" min="0" step="0.1" type="range" value={selectedPercent[property]} onChange={(event) => updatePlacementPercent(property, Number(event.target.value))} />
              </label>
            ))}
          </div>
          <div className="mini-grid">
            <label>Border Color<input type="color" value={toColorInput(selectedPlacement.borderColor)} onChange={(event) => updatePlacement(activeField, { borderColor: event.target.value })} /></label>
            <label>Radius<input type="number" value={selectedPlacement.borderRadius} onChange={(event) => updatePlacement(activeField, { borderRadius: Number(event.target.value) })} /></label>
          </div>
          <div className="mini-grid">
            <label>Line Height<input step="0.05" type="number" value={selectedPlacement.lineHeight} onChange={(event) => updatePlacement(activeField, { lineHeight: Number(event.target.value) })} /></label>
            <label>Letter Space<input type="number" value={selectedPlacement.letterSpacing} onChange={(event) => updatePlacement(activeField, { letterSpacing: Number(event.target.value) })} /></label>
            <label>Rotate<input type="number" value={selectedPlacement.rotate} onChange={(event) => updatePlacement(activeField, { rotate: Number(event.target.value) })} /></label>
            <label>Padding<input type="number" value={selectedPlacement.padding} onChange={(event) => updatePlacement(activeField, { padding: Number(event.target.value) })} /></label>
          </div>
          <div className="template-action-row wide">
            <button disabled={!placements[activeField] || selectedPlacement.locked} onClick={() => centerFieldOnSlip(activeField)} type="button">Center Field on Slip</button>
            <button disabled={!placements[activeField] || selectedPlacement.locked} onClick={() => fullWidthCenterField(activeField)} type="button">Full Width + Center Text</button>
          </div>
          <div className="template-action-row">
            <button disabled={!placements[activeField] || selectedPlacement.locked} onClick={() => removePlacement(activeField)} type="button">Delete Field</button>
            <button disabled={!placements[activeField]} onClick={() => duplicatePlacement(activeField)} type="button">Duplicate</button>
          </div>
        </div>
        <div className="template-settings layers-panel">
          <strong>Layers ({Object.keys(placements).length})</strong>
          {Object.entries(placements).reverse().map(([key]) => {
            return (
              <div className={activeField === key ? 'layer-row active' : 'layer-row'} key={key}>
                <button onClick={() => setActiveField(key)} type="button">{templateFieldLabel(key, fieldOptions, placements)}</button>
                <button disabled={placements[key]?.locked} onClick={() => removePlacement(key)} type="button">{placements[key]?.locked ? 'Locked' : 'Delete'}</button>
              </div>
            );
          })}
        </div>
        <div className="add-field">
          <strong>Add Compulsory Custom Field</strong>
          <input value={fieldLabel} onChange={(event) => setFieldLabel(event.target.value)} placeholder="e.g. Building / Lane" />
          <button onClick={() => { void handleAddEditorField(fieldLabel, true); setFieldLabel(''); }} type="button">
            <Plus size={18} />Add
          </button>
        </div>
        <div className="add-field optional-field">
          <strong>Add Optional Custom Field</strong>
          <span>Use this for information that may be left blank on a receipt.</span>
          <input value={optionalFieldLabel} onChange={(event) => setOptionalFieldLabel(event.target.value)} placeholder="e.g. Sponsor Category" />
          <button onClick={() => { void handleAddEditorField(optionalFieldLabel, false); setOptionalFieldLabel(''); }} type="button">
            <Plus size={18} />Add
          </button>
        </div>
      </aside>
    </section>
  );
}

function Stat({ icon, label, note, value }: { icon: ReactNode; label: string; note: string; value: string }) {
  return (
    <article className="stat">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function defaultPlacement(): TemplatePlacement {
  return {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderColor: '#ff4f0a',
    borderRadius: 6,
    color: '#111111',
    fontFamily: 'Arial, sans-serif',
    fontSize: 28,
    fontStyle: 'normal',
    fontWeight: 800,
    height: 48,
    letterSpacing: 0,
    lineHeight: 1.15,
    locked: false,
    opacity: 1,
    padding: 5,
    rotate: 0,
    shadow: false,
    textAlign: 'left',
    textDecoration: 'none',
    textTransform: 'none',
    textWrap: 'single',
    width: 280,
    x: 120,
    y: 120,
  };
}

function normalizeCssColor(value?: string) {
  return (value ?? '').toLowerCase().replace(/\s+/g, '');
}

function shouldPrintFieldBackground(value?: string) {
  const color = normalizeCssColor(value);
  return Boolean(color) && color !== 'transparent' && color !== 'rgba(255,255,255,0.78)';
}

function shouldPrintFieldBorder(value?: string) {
  const color = normalizeCssColor(value);
  return Boolean(color) && color !== 'transparent' && color !== '#ff4f0a';
}

function baseTemplateFieldKey(key: string) {
  return key.replace(/_copy_\d+$/, '');
}

function uniqueTemplateFieldOptions(options: Array<{ key: string; label: string }>) {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.key)) return false;
    seen.add(option.key);
    return true;
  });
}

function templateFieldLabel(
  key: string,
  fieldOptions: Array<{ key: string; label: string }>,
  placements: Record<string, TemplatePlacement>,
) {
  const baseKey = baseTemplateFieldKey(key);
  const baseLabel = fieldOptions.find((field) => field.key === baseKey)?.label ?? baseKey;
  const sameFieldKeys = Object.keys(placements).filter((fieldKey) => baseTemplateFieldKey(fieldKey) === baseKey);
  const index = sameFieldKeys.indexOf(key);
  return index > 0 ? `${baseLabel} ${index + 1}` : baseLabel;
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = canvasWidth / canvasHeight;
  const drawWidth = imageRatio > canvasRatio ? canvasWidth : canvasHeight * imageRatio;
  const drawHeight = imageRatio > canvasRatio ? canvasWidth / imageRatio : canvasHeight;
  const drawX = (canvasWidth - drawWidth) / 2;
  const drawY = (canvasHeight - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function transformTemplateText(text: string, placement: TemplatePlacement) {
  if (placement.textTransform === 'uppercase') return text.toUpperCase();
  if (placement.textTransform === 'capitalize') {
    return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  return text;
}

function drawCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
) {
  if (!letterSpacing) {
    ctx.fillText(text, x, y);
    return;
  }

  const chars = Array.from(text);
  const textWidth = chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) + letterSpacing * Math.max(0, chars.length - 1);
  let cursor = x;
  if (ctx.textAlign === 'center') {
    cursor = x - textWidth / 2;
  } else if (ctx.textAlign === 'right') {
    cursor = x - textWidth;
  }

  chars.forEach((char) => {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + letterSpacing;
  });
}

function drawWrappedCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  fontSize: number,
  lineHeight: number,
  letterSpacing: number,
) {
  const lines = wrapCanvasText(ctx, text, maxWidth);
  const lineStep = fontSize * lineHeight;
  const maxLines = Math.max(1, Math.floor(maxHeight / lineStep));
  lines.slice(0, maxLines).forEach((line, index) => {
    drawCanvasText(ctx, line, x, y + index * lineStep, letterSpacing);
  });
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let currentLine = words[0];

  words.slice(1).forEach((word) => {
    const candidate = `${currentLine} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  lines.push(currentLine);
  return lines;
}

function normalizeTemplatePlacements(
  fields?: Record<string, Partial<TemplatePlacement>>,
): Record<string, TemplatePlacement> {
  if (!fields || typeof fields !== 'object') return {};
  return Object.fromEntries(
    Object.entries(fields)
      .filter((entry): entry is [string, Partial<TemplatePlacement>] => Boolean(entry[1]) && typeof entry[1] === 'object')
      .map(([key, placement]) => [
        key,
        {
          ...defaultPlacement(),
          ...placement,
        },
      ]),
  );
}

function clonePlacementMap(placements: Record<string, TemplatePlacement>) {
  return Object.fromEntries(
    Object.entries(placements).map(([key, placement]) => [key, { ...placement }]),
  );
}

function findActiveTemplateVersion(templates: Template[] = []) {
  return templates
    .flatMap((template) => template.versions)
    .find((version) => version.isActive);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toColorInput(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (value === 'transparent') return '#ffffff';
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return '#ffffff';
  return `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
}



function isSlipPaid(slip: Slip) {
  return (slip.status ?? 'ACTIVE').toUpperCase() !== 'PENDING';
}

function whatsappStatusMessage(slip: Slip, result: WhatsAppSendResult | null | undefined, action: 'generated' | 'shared') {
  const base = `Slip ${slip.slipNumber} ${action}.`;
  if (!result) return `${base} WhatsApp status is pending.`;
  if (result.status === 'sent') return `${base} WhatsApp receipt sent to ${slip.contributorPhone || 'donor number'}.`;
  if (result.status === 'skipped') return `${base} WhatsApp sending is not enabled yet.`;
  if (result.reason === 'missing_whatsapp_number') return `${base} Add a valid WhatsApp number and use Share again.`;
  return `${base} WhatsApp could not be sent. Try Share again.`;
}

function workspaceQueryKey(session: AuthSession) {
  return ['workspace-bootstrap', session.user.role, session.user.mandalId ?? 'owner', session.user.id];
}

function workspaceCacheKey(session: AuthSession) {
  return `${WORKSPACE_CACHE_PREFIX}:${session.user.id}`;
}

function readWorkspaceCache(session: AuthSession): WorkspaceBootstrap | null {
  try {
    const stored = window.localStorage.getItem(workspaceCacheKey(session));
    return stored ? JSON.parse(stored) as WorkspaceBootstrap : null;
  } catch {
    return null;
  }

}

function writeWorkspaceCache(session: AuthSession, workspace: WorkspaceBootstrap) {
  try {
    window.localStorage.setItem(workspaceCacheKey(session), JSON.stringify(workspace));
  } catch {
    // Storage can be unavailable or full; live data still remains usable in memory.
  }
}

function mapBackendMandal(
  mandal: DemoMandal & {
    contactName?: string | null;
    contactPhone?: string | null;
    logoUrl?: string | null;
    users?: MandalLoginUser[];
  },
): DemoMandal {
  return {
    _count: mandal._count,
    additionalMembers: mandal.additionalMembers ?? '',
    address: mandal.address ?? '',
    adhyakshName: mandal.contactName ?? mandal.adhyakshName ?? '',
    adminEmail: mandal.adminEmail,
    adminPassword: mandal.adminPassword,
    city: mandal.city ?? '',
    contactEmail: mandal.contactEmail ?? '',
    contactName: mandal.contactName ?? '',
    contactPhone: mandal.contactPhone ?? '',
    festivals: mandal.festivals ?? [],
    id: mandal.id,
    khajindarName: mandal.khajindarName ?? '',
    logoUrl: mandal.logoUrl ?? '',
    locality: mandal.locality ?? '',
    memberCount: String(mandal._count?.members ?? mandal.memberCount ?? 0),
    name: mandal.name,
    nameMr: mandal.nameMr ?? '',
    partner: mandal.partner ?? null,
    partnerId: mandal.partnerId ?? mandal.partner?.id ?? null,
    plan: mandal.plan ?? 'starter',
    slug: mandal.slug,
    slipLimit: mandal.slipLimit ?? null,
    state: mandal.state ?? '',
    status: mandal.status,
    users: (mandal.users ?? []).filter((user) => user.status === 'ACTIVE'),
    whatsappMode: mandal.whatsappMode ?? 'AUTO_API',
    whatsappTemplateLanguage: mandal.whatsappTemplateLanguage ?? null,
    whatsappTemplateName: mandal.whatsappTemplateName ?? null,
    whatsappTemplateVariableCount: mandal.whatsappTemplateVariableCount ?? null,
    whatsappTemplateWid: mandal.whatsappTemplateWid ?? null,
  };
}

function festivalYear(festival?: Festival | null) {
  if (!festival) return null;
  if (festival.startDate) {
    const year = new Date(festival.startDate).getUTCFullYear();
    if (Number.isFinite(year)) return year;
  }
  const match = festival.name.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function money(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number.isFinite(value) ? value : 0);
}

function formatLogTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: value.slice(0, 10), time: '' };
  }

  return {
    date: new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date),
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'mandal';
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

async function imageFileToCompressedDataUrl(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file for mandal logo.');
  }

  const originalDataUrl = await fileToDataUrl(file);
  const image = await loadImageElement(originalDataUrl);
  const maxSide = 640;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) return originalDataUrl;
  ctx.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.82);
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not process mandal logo. Try a smaller JPG or PNG image.'));
    image.src = src;
  });
}

function absoluteAppUrl(pathOrUrl: string) {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, window.location.origin).toString();
}

function resolveTemplateAssetUrl(pathOrUrl: string) {
  const value = pathOrUrl?.trim() || TEMPLATE_IMAGE;
  if (value.startsWith('data:')) return value;
  if (!/^https?:\/\//.test(value)) return absoluteAppUrl(value);

  try {
    const url = new URL(value);
    const isLocalTemplateAsset =
      ['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/templates/');
    if (isLocalTemplateAsset) {
      return new URL(`${url.pathname}${url.search}`, window.location.origin).toString();
    }
  } catch {
    return value;
  }

  return value;
}

function mandalLoginUrl() {
  return `${window.location.origin}${window.location.pathname}${window.location.search}#/login`;
}

function generateTemporaryPassword() {
  return `Dv@${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}
