import type { requestCategories } from "./requests";

// Documents the Board must post in common areas (owner list, 19 November 2026).
// Community documents links each one to a pre-filled Help desk Document request.
export const mandatoryDocuments = [
  "Annual Financial Statements (AFS)",
  "Notice of Elections & Election Guidelines",
  "Master List of Qualified Voters",
  "Official Election Results / Tally",
  "Notice of General Assembly / Special Meetings",
  "Proposed Amendments to Articles or By-Laws",
  "New House Rules, Traffic/Parking Rules & Fee/Fine Schedules",
] as const;

// Triage labels only: none of these choices grants a service or establishes a violation.
export const requestTopics: Record<
  (typeof requestCategories)[number],
  Record<string, readonly string[]>
> = {
  Maintenance: {
    Lighting: [
      "Streetlight not working",
      "Flickering light",
      "Damaged light fixture",
    ],
    "Roads and walkways": [
      "Road damage",
      "Damaged sidewalk",
      "Obstructed walkway",
    ],
    "Water and drainage": [
      "Water leak",
      "Blocked drain",
      "Flooding or standing water",
    ],
    Amenities: ["Damaged equipment", "Cleaning needed", "Facility repair"],
    "Waste and landscaping": [
      "Uncollected waste",
      "Tree or plant maintenance",
      "Shared-area cleaning",
    ],
  },
  Complaint: {
    Noise: ["Loud music", "Construction noise", "Repeated disturbance"],
    "Pets and animals": [
      "Unattended pet",
      "Animal waste",
      "Animal disturbance",
    ],
    "Parking and vehicles": [
      "Blocked driveway",
      "Parking concern",
      "Vehicle disturbance",
    ],
    "Neighbour conduct": [
      "Dispute",
      "Harassment or threatening behaviour",
      "Shared-space concern",
    ],
    "Building activity": [
      "Construction disturbance",
      "Debris or obstruction",
      "Property damage concern",
    ],
  },
  Concern: {
    "Community safety": [
      "Access concern",
      "Shared-area hazard",
      "Security service concern",
    ],
    "Office services": [
      "Follow-up",
      "Processing concern",
      "Communication concern",
    ],
    "Utilities and surroundings": [
      "Water service",
      "Waste collection",
      "Environmental concern",
    ],
  },
  Idea: {
    "Community improvement": [
      "Facilities",
      "Landscaping",
      "Community activity",
    ],
    "Service improvement": ["Office process", "Transport", "Portal experience"],
    "Safety improvement": ["Road safety", "Lighting", "Emergency preparedness"],
  },
  Document: {
    "Mandatory Documents": mandatoryDocuments,
    "Document request": [
      "Clearance requirements",
      "Certification requirements",
      "Available HOA records",
    ],
    "Existing request": ["Follow-up", "Correction", "Replacement requirements"],
  },
  Support: {
    "Account and portal": [
      "Sign-in help",
      "Profile help",
      "Property-link help",
    ],
    "Dues and payments": [
      "Buyani payment help",
      "Missing receipt",
      "Billing question",
    ],
    "Community services": [
      "Amenity booking",
      "Shuttle",
      "Marketplace submission",
    ],
  },
};
