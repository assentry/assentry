// The profile details a person can declare, grouped for the Profile page.
// Keys are what websites ask for through the SDK's getProfile, so they
// follow common naming (OpenID Connect style) where one exists.
export interface ProfileField {
  key: string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "textarea";
  placeholder?: string;
}

export const PROFILE_CATEGORIES: { title: string; fields: ProfileField[] }[] = [
  {
    title: "Basics",
    fields: [
      { key: "name", label: "Full name", placeholder: "Ada Lovelace" },
      { key: "preferred_name", label: "Preferred name", placeholder: "Ada" },
      { key: "birthdate", label: "Date of birth", type: "date" },
    ],
  },
  {
    title: "Contact",
    fields: [
      { key: "email", label: "Email", type: "email", placeholder: "you@example.com" },
      { key: "phone_number", label: "Phone number", type: "tel", placeholder: "+44 7700 900000" },
      { key: "address", label: "Address", type: "textarea", placeholder: "Street, city, postcode, country" },
    ],
  },
  {
    title: "Work",
    fields: [
      { key: "job_title", label: "Job title", placeholder: "Engineer" },
      { key: "employer", label: "Employer", placeholder: "Company name" },
      { key: "resume", label: "CV / resume", type: "textarea", placeholder: "Paste your CV or a link to it" },
    ],
  },
];

export const PROFILE_FIELDS: ProfileField[] = PROFILE_CATEGORIES.flatMap((c) => c.fields);
