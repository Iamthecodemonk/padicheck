export type EducationLevel = 'ssce' | 'ond' | 'hnd' | 'bsc' | 'msc' | 'phd';
export type WorkMode = 'On-site' | 'Hybrid' | 'Remote';

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  mode: WorkMode;
  salary: string;
  interest: string;
  skills: string[];
  minEducation: EducationLevel;
  minYears: number;
  verifiedEmployer: boolean;
  postedAt: string;
  description: string;
}

export interface Candidate {
  id: string;
  name: string;
  headline: string;
  location: string;
  interests: string[];
  skills: string[];
  education: EducationLevel;
  years: number;
  certifications: string[];
  verifiedId: boolean;
  availability: 'Immediately' | '2 weeks' | '1 month';
  openTo: WorkMode[];
}

export interface SeekerProfile {
  interests: string[];
  skills: string[];
  education: EducationLevel;
  years: number;
  location: string;
  modes: WorkMode[];
}

export interface HiringBrief {
  role: string;
  interest: string;
  skills: string[];
  minEducation: EducationLevel;
  minYears: number;
  location: string;
  mode: WorkMode;
}

export interface Match<T> {
  item: T;
  score: number;
  matched: string[];
  missing: string[];
  reasons: string[];
}