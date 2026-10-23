import React from 'react';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { ChipPicker } from './ChipPicker';
import { educationLevels, jobInterests, skillsByInterest, talentLocations } from '../../data/talent';
import { chipClass } from '../../utils/formStyles';
import type { SeekerProfile, WorkMode } from '../../types/talent';

interface SeekerFormProps {
  profile: SeekerProfile;
  onChange: (profile: SeekerProfile) => void;
}

const modes: WorkMode[] = ['On-site', 'Hybrid', 'Remote'];

export function SeekerForm({ profile, onChange }: SeekerFormProps) {
  const set = <K extends keyof SeekerProfile,>(key: K, value: SeekerProfile[K]) => onChange({ ...profile, [key]: value });
  const suggestions = Array.from(new Set((profile.interests.length ? profile.interests : jobInterests.slice(0, 3)).flatMap((i) => skillsByInterest[i] ?? [])));

  return (
    <div className="space-y-6">
      <ChipPicker label="What work interests you?" options={jobInterests} value={profile.interests} onChange={(v) => set('interests', v)} max={3} />
      <ChipPicker label="Your skills" options={suggestions} value={profile.skills} onChange={(v) => set('skills', v)} allowCustom />

      <fieldset>
        <legend className="text-sm font-medium text-ink">Highest qualification</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {educationLevels.map((e) =>
          <button key={e.id} type="button" aria-pressed={profile.education === e.id} onClick={() => set('education', e.id)} className={chipClass(profile.education === e.id)}>
              {e.label}
            </button>
          )}
        </div>
      </fieldset>

      <div>
        <span className="text-sm font-medium text-ink" id="years-label">
          Years of experience
        </span>
        <div className="mt-2 flex items-center gap-3" role="group" aria-labelledby="years-label">
          <button type="button" aria-label="Fewer years" onClick={() => set('years', Math.max(0, profile.years - 1))} className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink ring-1 ring-line">
            <MinusIcon className="h-4 w-4" />
          </button>
          <span className="min-w-[64px] text-center text-2xl font-bold tabular-nums text-ink" aria-live="polite">
            {profile.years}
            {profile.years >= 30 ? '+' : ''}
          </span>
          <button type="button" aria-label="More years" onClick={() => set('years', Math.min(30, profile.years + 1))} className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink ring-1 ring-line">
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Where do you want to work?</legend>
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
          {talentLocations.map((l) =>
          <button key={l} type="button" aria-pressed={profile.location === l} onClick={() => set('location', l)} className={chipClass(profile.location === l)}>
              {l}
            </button>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Work style</legend>
        <div className="mt-2 flex gap-2">
          {modes.map((m) => {
            const on = profile.modes.includes(m);
            return (
              <button key={m} type="button" aria-pressed={on} onClick={() => set('modes', on ? profile.modes.filter((x) => x !== m) : [...profile.modes, m])} className={chipClass(on)}>
                {m}
              </button>);

          })}
        </div>
      </fieldset>
    </div>);

}