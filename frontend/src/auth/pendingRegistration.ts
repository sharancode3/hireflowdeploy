export type PendingRegistrationRole = "JOB_SEEKER" | "RECRUITER";

export type PendingRegistration = {
  email: string;
  fullName?: string;
  mobile?: string;
  role?: PendingRegistrationRole;
  companyName?: string;
};

const KEY_EMAIL = "hireflow_pending_email";
const KEY_NAME = "hireflow_pending_name";
const KEY_MOBILE = "hireflow_pending_mobile";
const KEY_ROLE = "hireflow_pending_role";
const KEY_COMPANY = "hireflow_pending_company";

export function savePendingRegistration(data: PendingRegistration) {
  if (data.email) sessionStorage.setItem(KEY_EMAIL, data.email);
  if (data.fullName) sessionStorage.setItem(KEY_NAME, data.fullName);
  if (data.mobile) sessionStorage.setItem(KEY_MOBILE, data.mobile);
  if (data.role) sessionStorage.setItem(KEY_ROLE, data.role);
  if (data.companyName) sessionStorage.setItem(KEY_COMPANY, data.companyName);
}

export function loadPendingRegistration(): PendingRegistration {
  return {
    email: sessionStorage.getItem(KEY_EMAIL) || "",
    fullName: sessionStorage.getItem(KEY_NAME) || undefined,
    mobile: sessionStorage.getItem(KEY_MOBILE) || undefined,
    role: (sessionStorage.getItem(KEY_ROLE) as PendingRegistrationRole | null) || undefined,
    companyName: sessionStorage.getItem(KEY_COMPANY) || undefined,
  };
}

export function clearPendingRegistration() {
  sessionStorage.removeItem(KEY_EMAIL);
  sessionStorage.removeItem(KEY_NAME);
  sessionStorage.removeItem(KEY_MOBILE);
  sessionStorage.removeItem(KEY_ROLE);
  sessionStorage.removeItem(KEY_COMPANY);
}
