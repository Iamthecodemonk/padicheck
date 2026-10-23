export interface PreferenceOption {
  value: string;
  label: string;
  hint?: string;
}

export const countryOptions: PreferenceOption[] = [
{ value: 'NG', label: 'Nigeria' },
{ value: 'GH', label: 'Ghana' },
{ value: 'KE', label: 'Kenya' },
{ value: 'ZA', label: 'South Africa' },
{ value: 'GB', label: 'United Kingdom' },
{ value: 'US', label: 'United States' }];


export const currencyOptions: PreferenceOption[] = [
{ value: 'NGN', label: 'Nigerian Naira', hint: '₦' },
{ value: 'GHS', label: 'Ghanaian Cedi', hint: '₵' },
{ value: 'KES', label: 'Kenyan Shilling', hint: 'KSh' },
{ value: 'ZAR', label: 'South African Rand', hint: 'R' },
{ value: 'GBP', label: 'British Pound', hint: '£' },
{ value: 'USD', label: 'US Dollar', hint: '$' }];


export const languageOptions: PreferenceOption[] = [
{ value: 'en', label: 'English' },
{ value: 'pcm', label: 'Naijá (Pidgin)' },
{ value: 'yo', label: 'Yorùbá' },
{ value: 'ig', label: 'Igbo' },
{ value: 'ha', label: 'Hausa' },
{ value: 'fr', label: 'Français' },
{ value: 'sw', label: 'Kiswahili' }];


export interface NotificationType {
  id: string;
  label: string;
  hint: string;
}

export const notificationTypes: NotificationType[] = [
{ id: 'analysis', label: 'Analysis completed', hint: 'When a check you started is ready' },
{ id: 'research', label: 'Deep research completed', hint: 'Longer checks that run in the background' },
{ id: 'documents', label: 'Document processing', hint: 'When uploaded files are ready' },
{ id: 'payments', label: 'Payments & credits added', hint: 'Receipts for purchases' },
{ id: 'lowCredits', label: 'Credits running low', hint: 'Once, when you drop below 5 credits' },
{ id: 'account', label: 'Account & security', hint: 'New sign-ins and important changes' },
{ id: 'support', label: 'Support replies', hint: 'When our team responds' }];