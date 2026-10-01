"use client";

import type { ComponentType } from "react";
import type { ModelOption } from "@/lib/chat/models";
import { SettingsChoice, SettingsSection, SettingsTextField } from "@/components/settings/settings-section";
import { chatModelToPreferenceModel, preferenceModelToChatModel, resolveDefaultModel } from "@/lib/preferences/model";
import { aboutYouLimit, preferredNameLimit, type PreferencePatch, type UserPreferences } from "@/lib/preferences/types";

export type SettingsSectionProps = {
  preferences: UserPreferences;
  models: ModelOption[];
  disabled: boolean;
  onChange: (patch: PreferencePatch) => void;
};

const languageOptions = [
  { value: "auto", label: "Auto" },
  { value: "en", label: "English" },
  { value: "id", label: "Bahasa Indonesia" },
] as const;

const lengthOptions = [
  { value: "concise", label: "Concise" },
  { value: "balanced", label: "Balanced" },
  { value: "detailed", label: "Detailed" },
] as const;

const styleOptions = [
  { value: "natural", label: "Natural" },
  { value: "professional", label: "Professional" },
  { value: "direct", label: "Direct" },
] as const;

export function GeneralSettingsSection({ preferences, disabled, onChange }: SettingsSectionProps) {
  return <SettingsSection title="General" description="Language Nibie should prefer when you have not asked for one.">
    <SettingsChoice label="Preferred language" hint="Auto follows the language you are using. English and Bahasa Indonesia are saved on your account." value={preferences.preferredLanguage} options={[...languageOptions]} disabled={disabled} onChange={(preferredLanguage) => onChange({ preferredLanguage })} />
  </SettingsSection>;
}

export function NibieSettingsSection({ preferences, models, disabled, onChange }: SettingsSectionProps) {
  const available = models.map((option) => option.id);
  const options = models.map((option) => ({ value: chatModelToPreferenceModel[option.id], label: option.label }));
  const storedMode = preferenceModelToChatModel[preferences.defaultModel];
  const storedIsAvailable = available.includes(storedMode);
  const fallback = resolveDefaultModel(preferences.defaultModel, available);
  const hint = storedIsAvailable || !fallback
    ? "Used when you start a new chat. Conversations you already have keep their own model."
    : `${storedMode} isn't available, so new chats use ${fallback}. Conversations you already have keep their own model.`;
  return <SettingsSection title="Nibie" description="Defaults for new conversations. They do not change a chat you already started.">
    <SettingsChoice label="Default model" hint={hint} value={preferences.defaultModel} options={options} disabled={disabled || options.length === 0} onChange={(defaultModel) => onChange({ defaultModel })} />
    <SettingsChoice label="Response length" value={preferences.responseLength} options={[...lengthOptions]} disabled={disabled} onChange={(responseLength) => onChange({ responseLength })} />
    <SettingsChoice label="Response style" value={preferences.responseStyle} options={[...styleOptions]} disabled={disabled} onChange={(responseStyle) => onChange({ responseStyle })} />
  </SettingsSection>;
}

export const ChatSettingsSection: ComponentType<SettingsSectionProps> = function ChatSettingsSection() {
  return <SettingsSection title="Chat" description="How composing and reading a conversation behaves on this device.">
    <p className="settings-note">Enter to send, auto-follow, timestamps, and restoring the last chat will be added here. They stay on this device.</p>
  </SettingsSection>;
}

export function PersonalizationSettingsSection({ preferences, disabled, onChange }: SettingsSectionProps) {
  return <SettingsSection title="Personalization" description="Optional details Nibie may use when you want them. This is not hidden memory.">
    <SettingsTextField id="preferred-name" label="Preferred name" hint="A short name. Leave blank to clear it." value={preferences.preferredName ?? ""} maxLength={preferredNameLimit} disabled={disabled} onCommit={(preferredName) => onChange({ preferredName })} />
    <SettingsTextField id="about-you" label="About you" hint="Role, goals, or working context. Leave blank to clear it." value={preferences.aboutYou ?? ""} maxLength={aboutYouLimit} multiline disabled={disabled} onCommit={(aboutYou) => onChange({ aboutYou })} />
  </SettingsSection>;
}

export const DataSettingsSection: ComponentType<SettingsSectionProps> = function DataSettingsSection() {
  return <SettingsSection title="Data & Privacy" description="Your conversations belong to your account.">
    <p className="settings-note">Export and deleting every conversation will be added here. Sign out stays in the account area and still signs out of every device.</p>
  </SettingsSection>;
}
