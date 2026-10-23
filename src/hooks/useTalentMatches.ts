import { useEffect, useRef, useState } from 'react';
import { usePersistentState } from './usePersistentState';
import { candidates, jobListings } from '../data/talent';
import { matchCandidates, matchJobs } from '../utils/talentMatch';
import type { Candidate, HiringBrief, JobListing, Match, SeekerProfile } from '../types/talent';

type Status = 'idle' | 'loading' | 'done';

const defaultProfile: SeekerProfile = { interests: [], skills: [], education: 'bsc', years: 1, location: 'Lagos', modes: [] };
const defaultBrief: HiringBrief = { role: '', interest: 'Finance & Accounting', skills: [], minEducation: 'hnd', minYears: 1, location: 'Lagos', mode: 'On-site' };

export function useTalentMatches() {
  const [profile, setProfile] = usePersistentState<SeekerProfile>('pc-talent-profile', defaultProfile);
  const [brief, setBrief] = usePersistentState<HiringBrief>('pc-talent-brief', defaultBrief);
  const [savedJobs, setSavedJobs] = usePersistentState<string[]>('pc-talent-saved', []);
  const [shortlist, setShortlist] = usePersistentState<string[]>('pc-talent-shortlist', []);
  const [intros, setIntros] = usePersistentState<string[]>('pc-talent-intros', []);
  const [jobStatus, setJobStatus] = useState<Status>('idle');
  const [hireStatus, setHireStatus] = useState<Status>('idle');
  const [jobMatches, setJobMatches] = useState<Match<JobListing>[]>([]);
  const [candidateMatches, setCandidateMatches] = useState<Match<Candidate>[]>([]);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const findJobs = () => {
    setJobStatus('loading');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setJobMatches(matchJobs(profile, jobListings));
      setJobStatus('done');
    }, 900);
  };

  const findCandidates = () => {
    setHireStatus('loading');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setCandidateMatches(matchCandidates(brief, candidates));
      setHireStatus('done');
    }, 900);
  };

  const toggle = (list: string[], id: string) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return {
    profile,
    setProfile,
    brief,
    setBrief,
    jobStatus,
    hireStatus,
    jobMatches,
    candidateMatches,
    findJobs,
    findCandidates,
    savedJobs,
    toggleSavedJob: (id: string) => setSavedJobs((l) => toggle(l, id)),
    savedJobListings: jobListings.filter((j) => savedJobs.includes(j.id)),
    shortlist,
    toggleShortlist: (id: string) => setShortlist((l) => toggle(l, id)),
    intros,
    requestIntro: (id: string) => setIntros((l) => l.includes(id) ? l : [...l, id]),
    profileReady: profile.interests.length > 0,
    briefReady: brief.skills.length > 0
  };
}