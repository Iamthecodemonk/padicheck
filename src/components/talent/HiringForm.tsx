import React from 'react';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { ChipPicker } from './ChipPicker';
import { educationLevels, jobInterests, skillsByInterest, talentLocations } from '../../data/talent';
import { chipClass, inputClass } from '../../utils/formStyles';
import type { HiringBrief, WorkMode } from '../../types/talent';

interface HiringFormProps {
  brief: HiringBrief;
  onChange: (brief: HiringBrief) => void;
}

const modes: WorkMode[] = ['On-site', 'Hybrid', 'Remote'];

export function HiringForm({ brief, onChange }: HiringFormProps) {
  const set = <K extends keyof HiringBrief,>(key: K, value: HiringBrief[K]) => onChange({ ...brief, [key]: value });

  return (
    <div className="space-y-6">
      <label className="block">
        <span className="text-sm font-medium text-ink">Role you’re hiring for</span>
        <input value={brief.role} onChange={(e) => set('role', e.target.value)} placeholder="e.g. Shop accountant" className={`${inputClass} bg-surface`} />
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Field</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {jobInterests.map((i) =>
          <button key={i} type="button" aria-pressed={brief.interest === i} onClick={() => onChange({ ...brief, interest: i, skills: brief.skills.filter((s) => (skillsByInterest[i] ?? []).includes(s)) })} className={chipClass(brief.interest === i)}>
              {i}
            </button>
          )}
        </div>
      </fieldset>

      <ChipPicker label="Must-have skills" options={skillsByInterest[brief.interest] ?? []} value={brief.skills} onChange={(v) => set('skills', v)} allowCustom />

      <fieldset>
        <legend className="text-sm font-medium text-ink">Minimum qualification</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {educationLevels.map((e) =>
          <button key={e.id} type="button" aria-pressed={brief.minEducation === e.id} onClick={() => set('minEducation', e.id)} className={chipClass(brief.minEducation === e.id)}>
              {e.label}
            </button>
          )}
        </div>
      </fieldset>

      <div>
        <span className="text-sm font-medium text-ink" id="min-years-label">
          Minimum experience (years)
        </span>
        <div className="mt-2 flex items-center gap-3" role="group" aria-labelledby="min-years-label">
          <button type="button" aria-label="Fewer years" onClick={() => set('minYears', Math.max(0, brief.minYears - 1))} className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink ring-1 ring-line">
            <MinusIcon className="h-4 w-4" />
          </button>
          <span className="min-w-[64px] text-center text-2xl font-bold tabular-nums text-ink" aria-live="polite">
            {brief.minYears}
          </span>
          <button type="button" aria-label="More years" onClick={() => set('minYears', Math.min(20, brief.minYears + 1))} className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink ring-1 ring-line">
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Location</legend>
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
          {talentLocations.map((l) =>
          <button key={l} type="button" aria-pressed={brief.location === l} onClick={() => set('location', l)} className={chipClass(brief.location === l)}>
              {l}
            </button>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Work style</legend>
        <div className="mt-2 flex gap-2">
          {modes.map((m) =>
          <button key={m} type="button" aria-pressed={brief.mode === m} onClick={() => set('mode', m)} className={chipClass(brief.mode === m)}>
              {m}
            </button>
          )}
        </div>
      </fieldset>
    </div>);

}