export type UserRole = "JOB_SEEKER" | "RECRUITER";

export type JobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";

export type User = {
  id: string;
  email: string;
  role: UserRole;
  isAdmin?: boolean;
  recruiterApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED";
};

export type Job = {
  id: string;
  recruiterId?: string;
  title: string;
  companyName: string;
  location: string;
  role: string;
  requiredSkills: string[];
  jobType: JobType;
  minExperienceYears: number;
  description: string;
  openToFreshers: boolean;
  reviewStatus?: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_REVISION";
  adminFeedback?: string | null;
  reviewedAt?: string | null;
  applicationDeadline?: string | null;
  createdAt: string;
};

export type EducationItem = {
  id: string;
  level?: "SCHOOL" | "DIPLOMA" | "BACHELOR" | "MASTER" | "PHD" | "OTHER";
  institution: string;
  degree: string;
  fieldOfStudy: string;
  awardingBody?: string | null;
  startYear: number;
  endYear: number | null;
  grade: string | null;
};

export type ExperienceItem = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  startDate: string; // ISO date
  endDate: string | null; // ISO date
  summary: string;
};

export type ProjectItem = {
  id: string;
  name: string;
  link: string | null;
  summary: string;
  skills: string[];
};

export type CertificationItem = {
  id: string;
  name: string;
  issuer: string;
  issuedOn: string; // ISO date
  expiresOn: string | null; // ISO date
  credentialUrl: string | null;
};

export type AchievementItem = {
  id: string;
  title: string;
  description: string;
  date: string | null; // ISO date
};

export type LanguageItem = {
  id: string;
  name: string;
  proficiency: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "NATIVE";
};

export type SkillProficiency = 1 | 2 | 3 | 4 | 5;

export type ResumeDensity = "COMPACT" | "NORMAL" | "SPACIOUS";

export type ResumeAccent = "ACCENT" | "NEUTRAL" | "MUTED";

export type ResumeFont = "Inter" | "Roboto" | "Georgia" | "Merriweather" | "Calibri" | "Times New Roman";

export type ResumePageMargin = "NARROW" | "NORMAL" | "WIDE";

export type ResumeDateFormat = "MM/YYYY" | "MONTH_YYYY" | "YYYY";

export type ResumeSectionKey =
  | "SUMMARY"
  | "SKILLS"
  | "EXPERIENCE"
  | "PROJECTS"
  | "EDUCATION"
  | "CERTIFICATIONS"
  | "ACHIEVEMENTS"
  | "LANGUAGES"
  | "VOLUNTEER"
  | "PUBLICATIONS"
  | "CUSTOM";

export type ResumeSettings = {
  sectionOrder: ResumeSectionKey[];
  hiddenSections: Partial<Record<ResumeSectionKey, boolean>>;

  density: ResumeDensity;
  accent: ResumeAccent;
  showSkillBars: boolean;
  showCharts: boolean;
  showTimeline: boolean;

  /* Extended settings (Phase 3) */
  fontFamily?: ResumeFont;
  fontSize?: 10 | 11 | 12 | 13;
  lineSpacing?: "1" | "1.15" | "1.5";
  pageMargin?: ResumePageMargin;
  accentColor?: string;
  dateFormat?: ResumeDateFormat;
  showPhoto?: boolean;
  groupSkillsByCategory?: boolean;
  customSectionTitle?: string;
  customSectionContent?: string;
};

export type JobSeekerProfile = {
  id: string;
  userId: string;
  photoDataUrl?: string | null;
  fullName: string;
  phone: string | null;
  location: string | null;
  headline?: string | null;
  about?: string | null;
  experienceYears: number;
  desiredRole: string | null;
  skills: string[];
  skillLevels?: Record<string, SkillProficiency>;
  interests?: string[];
  education?: EducationItem[];
  experience?: ExperienceItem[];
  projects?: ProjectItem[];
  certifications?: CertificationItem[];
  achievements?: AchievementItem[];
  languages?: LanguageItem[];
  isFresher: boolean;
  visibility: "PUBLIC" | "PRIVATE";
  activeGeneratedResumeId?: string | null;
};

export type RecruiterProfile = {
  id: string;
  userId: string;
  companyName: string;
  website: string | null;
  location: string | null;
  description: string | null;
};

export type ApplicationStatus =
  | "APPLIED"
  | "SHORTLISTED"
  | "REJECTED"
  | "INTERVIEW_SCHEDULED"
  | "OFFERED"
  | "HIRED";

export type ApplicationWithJob = {
  id: string;
  status: ApplicationStatus;
  interviewAt: string | null;
  createdAt: string;
  job: Job;
};

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type Trends = {
  topRoles: Array<{ label: string; value: number }>;
  industryHiring: Array<{ label: string; value: number }>;
  trendingSkills: Array<{ label: string; value: number }>;
  topCompanies: Array<{ label: string; value: number }>;
  growth: Array<{ label: string; value: number }>;
};

export type Resume = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type ResumeTemplate =
  | "ATS_PLAIN"
  | "TECH_FOCUSED"
  | "EXECUTIVE"
  | "STARTUP"
  | "ACADEMIC"
  | "MODERN"
  | "CLASSIC"
  | "MINIMAL";

export type ResumeSnapshot = {
  photoDataUrl?: string | null;
  fullName: string;
  phone: string | null;
  location: string | null;
  headline?: string | null;
  about?: string | null;
  experienceYears: number;
  desiredRole: string | null;
  skills: string[];
  skillLevels?: Record<string, SkillProficiency>;
  interests?: string[];
  education?: EducationItem[];
  experience?: ExperienceItem[];
  projects?: ProjectItem[];
  certifications?: CertificationItem[];
  achievements?: AchievementItem[];
  languages?: LanguageItem[];
  isFresher: boolean;
  visibility: "PUBLIC" | "PRIVATE";
};

export type GeneratedResume = {
  id: string;
  userId: string;
  template: ResumeTemplate;
  title: string;
  createdAt: string;
  snapshot: ResumeSnapshot;
  settings?: ResumeSettings;
  tags?: string[];
  performance?: {
    views: number;
    callbacks: number;
    lastViewedAt?: string | null;
  };
};
