import { educationLevels } from '../data/talent';
import type { Candidate, EducationLevel, HiringBrief, JobListing, Match, SeekerProfile } from '../types/talent';

const rank = (e: EducationLevel) => educationLevels.find((l) => l.id === e)?.rank ?? 0;
export const educationLabel = (e: EducationLevel) => educationLevels.find((l) => l.id === e)?.label ?? e;
const norm = (s: string) => s.trim().toLowerCase();

/**
 * Weighted match: interest 30, skills 35, qualification 15, experience 10, location/work mode 10.
 * Unverified employers are capped and flagged so risky listings never top the list.
 */
export function matchJobs(profile: SeekerProfile, jobs: JobListing[]): Match<JobListing>[] {
  const mySkills = profile.skills.map(norm);
  return jobs.
  map((job) => {
    const reasons: string[] = [];
    const missing: string[] = [];
    let score = 0;

    if (profile.interests.includes(job.interest)) {
      score += 30;
      reasons.push(`Matches your interest in ${job.interest}`);
    }

    const matched = job.skills.filter((s) => mySkills.includes(norm(s)));
    score += job.skills.length ? Math.round(matched.length / job.skills.length * 35) : 0;
    job.skills.filter((s) => !mySkills.includes(norm(s))).forEach((s) => missing.push(s));

    if (rank(profile.education) >= rank(job.minEducation)) {
      score += 15;
      reasons.push(`Your ${educationLabel(profile.education)} meets the requirement`);
    } else missing.push(`${educationLabel(job.minEducation)} or higher`);

    if (profile.years >= job.minYears) {
      score += 10;
      if (job.minYears > 0) reasons.push(`You have the ${job.minYears}+ years they ask for`);
    } else {
      score += Math.round(profile.years / Math.max(job.minYears, 1) * 6);
      missing.push(`${job.minYears}+ years’ experience`);
    }

    const placeOk = job.mode === 'Remote' || profile.location === 'Anywhere' || job.location === profile.location;
    const modeOk = profile.modes.length === 0 || profile.modes.includes(job.mode);
    if (placeOk && modeOk) {
      score += 10;
      reasons.push(job.mode === 'Remote' ? 'Remote — work from anywhere' : `${job.mode} in ${job.location}`);
    }

    if (!job.verifiedEmployer) score = Math.min(score, 45);
    return { item: job, score: Math.min(100, score), matched, missing, reasons };
  }).
  filter((m) => m.score >= 25).
  sort((a, b) => b.score - a.score);
}

export function matchCandidates(brief: HiringBrief, people: Candidate[]): Match<Candidate>[] {
  const wanted = brief.skills.map(norm);
  return people.
  map((c) => {
    const reasons: string[] = [];
    const missing: string[] = [];
    let score = 0;
    const theirs = c.skills.map(norm);

    if (c.interests.includes(brief.interest)) {
      score += 25;
      reasons.push(`Looking for ${brief.interest} roles`);
    }
    const matched = brief.skills.filter((s) => theirs.includes(norm(s)));
    score += wanted.length ? Math.round(matched.length / wanted.length * 35) : 15;
    brief.skills.filter((s) => !theirs.includes(norm(s))).forEach((s) => missing.push(s));

    if (rank(c.education) >= rank(brief.minEducation)) {
      score += 15;
      reasons.push(educationLabel(c.education));
    } else missing.push(`${educationLabel(brief.minEducation)}`);

    if (c.years >= brief.minYears) {
      score += 10;
      reasons.push(`${c.years} years’ experience`);
    } else missing.push(`${brief.minYears}+ years`);

    const placeOk = brief.mode === 'Remote' || brief.location === 'Anywhere' || c.location === brief.location;
    if (placeOk && c.openTo.includes(brief.mode)) {
      score += 10;
      reasons.push(brief.mode === 'Remote' ? 'Open to remote work' : `Based in ${c.location}`);
    }
    if (c.verifiedId) score += 5;
    return { item: c, score: Math.min(100, score), matched, missing, reasons };
  }).
  filter((m) => m.score >= 30).
  sort((a, b) => b.score - a.score);
}

export function matchTone(score: number): string {
  if (score >= 75) return 'bg-brand-soft text-brand-dark';
  if (score >= 50) return 'bg-sky-soft text-sky';
  return 'bg-caution-soft text-caution';
}